import { describe, it, expect } from "vitest";
import {
  AutoStopDetector,
  dbfsToLevel,
  encodeWav,
  encodeWavBuffer,
  levelHint,
  mergeChunks,
  PrerollBuffer,
  prerollFrameCount,
  sameNotes,
  toDbfs,
} from "../audioCapture";

function header(buf: ArrayBuffer) {
  const v = new DataView(buf);
  const str = (o: number, n: number) => String.fromCharCode.apply(null, Array.from(new Uint8Array(buf, o, n)));
  return {
    riff: str(0, 4),
    wave: str(8, 4),
    channels: v.getUint16(22, true),
    sampleRate: v.getUint32(24, true),
    byteRate: v.getUint32(28, true),
    bits: v.getUint16(34, true),
    dataBytes: v.getUint32(40, true),
  };
}

describe("encodeWav", () => {
  it("writes the capture rate into the header (48 kHz in → 48 kHz out)", () => {
    const h = header(encodeWavBuffer(new Float32Array(4800), 48000));
    expect(h.riff).toBe("RIFF");
    expect(h.wave).toBe("WAVE");
    expect(h.sampleRate).toBe(48000);
    expect(h.byteRate).toBe(96000);
    expect(h.channels).toBe(1);
    expect(h.bits).toBe(16);
    expect(h.dataBytes).toBe(9600);
  });

  it("honours other device rates such as 44.1 kHz", () => {
    expect(header(encodeWavBuffer(new Float32Array(10), 44100)).sampleRate).toBe(44100);
  });

  it("clips samples to 16-bit range", () => {
    const v = new DataView(encodeWavBuffer(new Float32Array([2, -2, 0]), 8000));
    expect(v.getInt16(44, true)).toBe(0x7fff);
    expect(v.getInt16(46, true)).toBe(-0x8000);
    expect(v.getInt16(48, true)).toBe(0);
  });

  it("returns an audio/wav blob of the right size", () => {
    const b = encodeWav(new Float32Array(100), 48000);
    expect(b.type).toBe("audio/wav");
    expect(b.size).toBe(44 + 200);
  });
});

describe("mergeChunks", () => {
  it("concatenates in order", () => {
    expect(Array.from(mergeChunks([new Float32Array([1, 2]), new Float32Array([3])]))).toEqual([1, 2, 3]);
  });
});

describe("level maths", () => {
  it("maps dBFS −60..0 onto 0..1", () => {
    expect(toDbfs(1)).toBe(0);
    expect(toDbfs(0)).toBe(-60);
    expect(toDbfs(0.1)).toBeCloseTo(-20, 5);
    expect(dbfsToLevel(-60)).toBe(0);
    expect(dbfsToLevel(-30)).toBeCloseTo(0.5);
    expect(dbfsToLevel(0)).toBe(1);
  });

  it("a normal guitar level no longer saturates the meter", () => {
    // −32 dBFS RMS pinned the old `rms*40` meter at 100%
    expect(dbfsToLevel(toDbfs(0.025))).toBeLessThan(0.5);
  });

  it("hints too quiet / clipping", () => {
    expect(levelHint(-50, 2)).toBe("too_quiet");
    expect(levelHint(-50, 0.5)).toBeNull(); // give the player a moment
    expect(levelHint(-0.5, 0.2)).toBe("clipping");
    expect(levelHint(-12, 2)).toBeNull();
  });
});

describe("AutoStopDetector", () => {
  // Real frame timing: 2048-sample ScriptProcessor blocks at 48 kHz.
  const frame = 2048 / 48000;

  /** Feed a per-frame RMS function until stop or `until`; returns stop time and reason. */
  function run(d: AutoStopDetector, rmsAt: (t: number) => number, until = 12) {
    let t = 0;
    while (t < until) {
      t += frame;
      const why = d.update(rmsAt(t), t);
      if (why) return { t, why };
    }
    return { t, why: null };
  }

  /** A strum starting at `at`: 0.2 RMS decaying with a 0.35 s time constant over a −62 dBFS floor. */
  const strum = (at: number) => (t: number) => (t < at ? 0.0008 : 0.0008 + 0.2 * Math.exp(-(t - at) / 0.35));

  it("stops 1.2 s after the strum decays below 15% of peak (unchanged behaviour)", () => {
    const d = new AutoStopDetector();
    const s = (t: number) => (t < 0.5 ? 0.001 : t < 1.0 ? 0.2 : t < 1.5 ? 0.1 : 0.01);
    const { t, why } = run(d, s);
    expect(why).toBe("decay");
    // quiet from 1.5 s, 1.2 s hold → about 2.7 s
    expect(t - 1.5).toBeGreaterThanOrEqual(1.2 - frame);
    expect(t - 1.5).toBeLessThan(1.3);
  });

  it("a click before the strum does not arm it or stop the take early", () => {
    const d = new AutoStopDetector();
    const strumAt = 1.6;
    const base = strum(strumAt);
    // One frame at 0.2 RMS at t≈0.2 s (Space / mouse click), then room noise.
    const clickFrame = Math.ceil(0.2 / frame);
    const s = (t: number) => (Math.round(t / frame) === clickFrame ? 0.2 : base(t));
    const { t, why } = run(d, s);
    expect(t).toBeGreaterThan(strumAt);
    expect(why).toBe("decay");
    expect(d.armedAt!).toBeGreaterThanOrEqual(strumAt);
    // armed within ~3 frames of the onset
    expect(d.armedAt! - strumAt).toBeLessThan(4 * frame);
  });

  it("a short click burst (2 frames) still does not arm", () => {
    const d = new AutoStopDetector();
    const s = (t: number) => (t > 0.4 && t < 0.4 + 2 * frame ? 0.3 : 0.0008);
    const { t, why } = run(d, s);
    expect(d.armed).toBe(false);
    expect(why).toBe("silent");
    expect(t).toBeGreaterThanOrEqual(3 - 1e-9);
  });

  it("pure silence stops with 'silent' at 3 s", () => {
    const d = new AutoStopDetector();
    const { t, why } = run(d, () => 0.0005);
    expect(why).toBe("silent");
    expect(t).toBeGreaterThanOrEqual(3 - 1e-9);
    expect(t).toBeLessThan(3 + frame + 1e-9);
  });

  it("loudness before ignoreSeconds cannot arm until 0.3 s", () => {
    const d = new AutoStopDetector();
    let t = 0;
    while (t + frame < 0.29) d.update(0.05, (t += frame));
    expect(d.armed).toBe(false);
    d.update(0.05, (t = 0.3));
    expect(d.armed).toBe(true);
    expect(d.loudRun).toBeGreaterThanOrEqual(3);
  });

  it("a quiet strum (−46 dBFS RMS) in a quiet room still arms (adaptive threshold)", () => {
    const d = new AutoStopDetector();
    const quiet = (t: number) => (t < 1 ? 0.0004 : 0.0004 + 0.005 * Math.exp(-(t - 1) / 0.6));
    const { why } = run(d, quiet);
    expect(d.armed).toBe(true);
    expect(why).toBe("decay");
    expect(d.loudRms).toBeLessThan(0.01);
  });

  it("a noisy room keeps the full threshold, so its noise never arms", () => {
    const d = new AutoStopDetector();
    const { why } = run(d, () => 0.006); // fan noise at −44 dBFS
    expect(d.loudRms).toBe(0.01);
    expect(why).toBe("silent");
  });

  it("a never-decaying sound hits the cap; maxAfterArmSeconds counts from the onset", () => {
    expect(run(new AutoStopDetector(), () => 0.1).why).toBe("max");
    const d = new AutoStopDetector({ maxSeconds: 60, maxAfterArmSeconds: 6, noStrumSeconds: 8 });
    const s = (t: number) => (t < 2 ? 0.0005 : 0.1);
    const { t, why } = run(d, s, 20);
    expect(why).toBe("max");
    expect(t - d.armedAt!).toBeGreaterThanOrEqual(6 - 1e-9);
    expect(t).toBeGreaterThan(8);
  });
});

describe("PrerollBuffer", () => {
  it("keeps the last ceil(0.25·sr/2048) frames, oldest first", () => {
    const n = prerollFrameCount(0.25, 48000, 2048);
    expect(n).toBe(6);
    expect(prerollFrameCount(0.25, 44100, 2048)).toBe(6);
    const b = new PrerollBuffer(n);
    for (let i = 0; i < 20; i++) b.push(new Float32Array([i]));
    expect(b.snapshot().map((f) => f[0])).toEqual([14, 15, 16, 17, 18, 19]);
    expect(b.snapshot(2).map((f) => f[0])).toEqual([18, 19]);
    expect(b.snapshot(99)).toHaveLength(6);
  });

  it("returns what it has before it fills, and clears", () => {
    const b = new PrerollBuffer(6);
    b.push(new Float32Array([1]));
    b.push(new Float32Array([2]));
    expect(b.snapshot().map((f) => f[0])).toEqual([1, 2]);
    b.clear();
    expect(b.size).toBe(0);
  });
});

describe("sameNotes", () => {
  it("ignores order", () => {
    expect(sameNotes(["C", "E", "G"], ["G", "C", "E"])).toBe(true);
    expect(sameNotes(["C"], ["C", "E"])).toBe(false);
  });
});
