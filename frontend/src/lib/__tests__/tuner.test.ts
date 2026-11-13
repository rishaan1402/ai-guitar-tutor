import { describe, it, expect } from "vitest";
import {
  OPEN_STRINGS,
  cents,
  centsText,
  initialLevel,
  initialTuner,
  levelHintFor,
  nearestString,
  pushLevel,
  pushReading,
  selectString,
  type TunerState,
} from "../tuner";
import { micBrowser, micHelp } from "../micHelp";
import { micErrorKind, micErrorMessage } from "../mic";

const at = (hz: number, c: number) => hz * Math.pow(2, c / 1200);

/** Feed readings every 50 ms (the tuner's 20 Hz loop). */
function feed(s: TunerState, hzs: number[], t0 = 0, clarity = 0.97, rms = -30) {
  let state = s;
  const tuned: number[] = [];
  hzs.forEach((hz, i) => {
    const r = pushReading(state, { hz, clarity, rmsDbfs: rms, t: t0 + i * 50 });
    state = r.state;
    if (r.justTuned !== null) tuned.push(r.justTuned);
  });
  return { state, tuned };
}

describe("cents and nearest string", () => {
  it("maps Hz to the nearest open string", () => {
    expect(nearestString(82.41)?.index).toBe(0);
    expect(nearestString(at(110, 20))).toMatchObject({ index: 1 });
    expect(nearestString(at(110, 20))!.cents).toBeCloseTo(20, 6);
    expect(nearestString(at(329.63, -12))!.index).toBe(5);
    expect(nearestString(30)).toBeNull(); // far from any string
    expect(nearestString(NaN)).toBeNull();
  });

  it("cents: an octave is 1200, a semitone 100", () => {
    expect(cents(220, 110)).toBeCloseTo(1200, 9);
    expect(cents(at(440, 100), 440)).toBeCloseTo(100, 9);
  });

  it("aria text says sharp / flat / in tune", () => {
    expect(centsText(12.4)).toBe("12 cents sharp");
    expect(centsText(-8)).toBe("8 cents flat");
    expect(centsText(0.2)).toBe("in tune");
    expect(centsText(3)).toBe("in tune (3 cents sharp)");
  });
});

describe("tuner state machine", () => {
  it("an in-tune low E held 500 ms goes 'tuned' and auto-advances to A", () => {
    const { state, tuned } = feed(initialTuner(0), Array(14).fill(at(OPEN_STRINGS[0].hz, 1)));
    expect(tuned).toEqual([0]);
    expect(state.tuned).toEqual([0]);
    expect(state.target).toBe(1);
  });

  it("+20 c reads +20 (±2) and never goes in tune", () => {
    const { state, tuned } = feed(initialTuner(0), Array(30).fill(at(82.4069, 20)));
    expect(tuned).toEqual([]);
    expect(state.cents!).toBeGreaterThan(18);
    expect(state.cents!).toBeLessThan(22);
  });

  it("median of 5 rejects a single outlier", () => {
    const hz = [0, 0, 40, 0, 0].map((c) => at(110, c));
    const { state } = feed(initialTuner(1), hz);
    expect(Math.abs(state.cents!)).toBeLessThan(1);
  });

  it("a hold shorter than 500 ms does not count; drifting out resets it", () => {
    const e = OPEN_STRINGS[0].hz;
    const seq = [...Array(8).fill(at(e, 0)), ...Array(6).fill(at(e, 30)), ...Array(8).fill(at(e, 0))];
    const { tuned } = feed(initialTuner(0), seq);
    expect(tuned).toEqual([]); // 8 × 50 ms = 350 ms each time
  });

  it("unclear or quiet readings are ignored", () => {
    let s = initialTuner(0);
    s = feed(s, Array(20).fill(82.41), 0, 0.5).state;
    expect(s.cents).toBeNull();
    s = feed(s, Array(20).fill(82.41), 0, 0.99, -60).state;
    expect(s.cents).toBeNull();
  });

  it("selecting a string only listens for that string", () => {
    const s = selectString(initialTuner(0), 3);
    const { state } = feed(s, Array(5).fill(at(OPEN_STRINGS[3].hz, -15)));
    expect(state.index).toBe(3);
    expect(state.cents!).toBeCloseTo(-15, 1);
  });
});

describe("level check", () => {
  it("passes at a −30 dBFS peak after the floor window; flags noise and clipping", () => {
    let s = initialLevel();
    for (let t = 0; t <= 600; t += 50) s = pushLevel(s, -62, -55, t);
    expect(s.floorDbfs).toBe(-62);
    expect(s.passed).toBe(false);
    s = pushLevel(s, -20, -12, 700);
    expect(s.passed).toBe(true);
    expect(levelHintFor(s)).toBeNull();

    let n = initialLevel();
    for (let t = 0; t <= 600; t += 50) n = pushLevel(n, -40, -30, t);
    expect(levelHintFor(n)).toBe("noisy");

    let c = initialLevel();
    for (let t = 0; t <= 600; t += 50) c = pushLevel(c, -20, -0.5, t);
    expect(levelHintFor(c)).toBe("clipping");
  });
});

describe("micHelp", () => {
  const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
  const IOS = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";
  const FIREFOX = "Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0";

  it("names the right browser and steps for 3 UAs", () => {
    expect(micBrowser(CHROME)).toBe("chrome");
    expect(micHelp(CHROME).steps.join(" ")).toMatch(/Site settings/);
    expect(micBrowser(IOS)).toBe("safari_ios");
    expect(micHelp(IOS).steps.join(" ")).toMatch(/aA/);
    expect(micBrowser(FIREFOX)).toBe("firefox");
    expect(micHelp(FIREFOX).steps.join(" ")).toMatch(/crossed-out microphone/);
    expect(micBrowser("")).toBe("other");
  });

  it("classifies getUserMedia errors", () => {
    expect(micErrorKind(new DOMException("x", "NotAllowedError"))).toBe("denied");
    expect(micErrorKind(new DOMException("x", "NotFoundError"))).toBe("not_found");
    expect(micErrorKind(new DOMException("x", "NotReadableError"))).toBe("busy");
    expect(micErrorMessage(new DOMException("x", "NotFoundError"))).toMatch(/No microphone/);
  });
});
