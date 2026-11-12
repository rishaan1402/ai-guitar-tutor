import { describe, it, expect } from "vitest";
import {
  createEnergyState,
  midiToHz,
  pitchClass,
  stringEnergies,
  stringTargets,
  stringVerdicts,
} from "../stringEnergy";
import type { ChordFingering } from "../api";

const SR = 48000;
const FFT = 8192;
const BINS = FFT / 2;
const BIN_HZ = SR / FFT;

const C_MAJOR: ChordFingering = {
  chord: "C_major",
  display_name: "C",
  root: "C",
  quality: "major",
  notes: ["C", "E", "G"],
  positions: [
    { string: 6, action: "mute" },
    { string: 5, fret: 3, note: "C", finger: 3 },
    { string: 4, fret: 2, note: "E", finger: 2 },
    { string: 3, fret: 0, note: "G" },
    { string: 2, fret: 1, note: "C", finger: 1 },
    { string: 1, fret: 0, note: "E" },
  ],
};

const E_MINOR: ChordFingering = {
  chord: "E_minor",
  display_name: "Em",
  root: "E",
  quality: "minor",
  notes: ["E", "G", "B"],
  positions: [
    { string: 6, fret: 0, note: "E" },
    { string: 5, fret: 2, note: "B", finger: 1 },
    { string: 4, fret: 2, note: "E", finger: 2 },
    { string: 3, fret: 0, note: "G" },
    { string: 2, fret: 0, note: "B" },
    { string: 1, fret: 0, note: "E" },
  ],
};

/** A dB spectrum: flat floor plus Blackman-ish peaks (3 bins) at the given frequencies. */
function spectrum(floorDb: number, peaks: [hz: number, db: number][] = []): Float32Array {
  const a = new Float32Array(BINS).fill(floorDb);
  for (const [hz, db] of peaks) {
    const k = Math.round(hz / BIN_HZ);
    for (const [o, drop] of [[-1, 6], [0, 0], [1, 6]] as const) {
      if (k + o >= 0 && k + o < BINS) a[k + o] = Math.max(a[k + o], db - drop);
    }
  }
  return a;
}

/** Feed `seconds` of identical frames at 60 fps. */
function feed(state: ReturnType<typeof createEnergyState>, frame: Float32Array, seconds: number, fingering = C_MAJOR) {
  const targets = stringTargets(fingering);
  const dt = 1 / 60;
  for (let t = 0; t < seconds; t += dt) stringEnergies(frame, SR, FFT, targets, state, dt);
  return state;
}

const C3 = midiToHz(48);
const E3 = midiToHz(52);
const G3 = midiToHz(55);

describe("stringTargets", () => {
  it("E minor → MIDI [40, 47, 52, 55, 59, 64], low E first", () => {
    const t = stringTargets(E_MINOR);
    expect(t.map((x) => x.midi)).toEqual([40, 47, 52, 55, 59, 64]);
    expect(t.map((x) => x.string)).toEqual([6, 5, 4, 3, 2, 1]);
    expect(t.every((x) => !x.muted)).toBe(true);
  });

  it("C major mutes string 6 and fingers C3/E3/G3/C4/E4", () => {
    const t = stringTargets(C_MAJOR);
    expect(t[0]).toMatchObject({ string: 6, muted: true, midi: null });
    expect(t.slice(1).map((x) => x.midi)).toEqual([48, 52, 55, 60, 64]);
  });

  it("missing fingering → six muted strings", () => {
    expect(stringTargets(null).every((x) => x.muted)).toBe(true);
  });
});

describe("stringEnergies", () => {
  it("peaks at C3, E3, G3 light strings 5, 4, 3 for C major; muted string 6 stays 0", () => {
    const s = createEnergyState();
    feed(s, spectrum(-100), 0.5); // room noise: sets the floor
    feed(s, spectrum(-100, [[C3, -20], [E3, -22], [G3, -21]]), 0.3);
    const [s6, s5, s4, s3] = Array.from(s.energy);
    expect(s5).toBeGreaterThan(0.6);
    expect(s4).toBeGreaterThan(0.6);
    expect(s3).toBeGreaterThan(0.6);
    expect(s6).toBe(0);
  });

  it("a flat noise floor gives near-zero energy everywhere", () => {
    const s = createEnergyState();
    feed(s, spectrum(-95), 0.5);
    feed(s, spectrum(-90), 1); // the room gets 5 dB louder, no notes
    for (const e of Array.from(s.energy)) expect(e).toBeLessThan(0.05);
    for (const x of Array.from(s.extra)) expect(x).toBe(0);
  });

  it("attack is fast (~30 ms) and release slow (~400 ms)", () => {
    const s = createEnergyState();
    feed(s, spectrum(-100), 0.5);
    feed(s, spectrum(-100, [[C3, -20]]), 0.2); // 120 ms confirm + 30 ms attack
    expect(s.energy[1]).toBeGreaterThan(0.8);
    feed(s, spectrum(-100), 0.1);
    expect(s.energy[1]).toBeGreaterThan(0.5); // still ringing down
    feed(s, spectrum(-100), 2);
    expect(s.energy[1]).toBeLessThan(0.05);
  });

  it("a brief blip (attack smear, < 120 ms) does not light a dark string", () => {
    const s = createEnergyState();
    feed(s, spectrum(-100), 0.5);
    feed(s, spectrum(-100, [[C3, -20]]), 0.07);
    expect(s.energy[1]).toBe(0);
  });

  it("listening that starts mid-strum still lights the strings (floor is capped)", () => {
    const s = createEnergyState();
    feed(s, spectrum(-100, [[C3, -20], [E3, -22], [G3, -21]]), 0.3);
    expect(s.energy[1]).toBeGreaterThan(0.6);
    expect(s.energy[3]).toBeGreaterThan(0.6);
  });

  it("a neighbouring note's skirt is not this string (B2 next to C3, one bin apart)", () => {
    const s = createEnergyState();
    feed(s, spectrum(-100), 0.5);
    feed(s, spectrum(-100, [[midiToHz(47), -20], [G3, -20]]), 0.5);
    expect(s.energy[1]).toBeLessThan(0.05); // C3 string dark
    expect(s.energy[3]).toBeGreaterThan(0.6); // G3 string lit
  });

  it("a non-chord peak (B2 under C major) flashes an extra on the nearest string", () => {
    const s = createEnergyState();
    feed(s, spectrum(-100), 0.5);
    const targets = stringTargets(C_MAJOR);
    stringEnergies(spectrum(-100, [[midiToHz(47), -20]]), SR, FFT, targets, s, 1 / 60);
    expect(s.extra[1]).toBeGreaterThan(0.9); // string 5 (C3) is the nearest
    feed(s, spectrum(-100), 0.6);
    expect(s.extra[1]).toBeLessThan(0.1); // a short flash
  });

  it("chord-tone octaves and upper partials are not extras", () => {
    const s = createEnergyState();
    feed(s, spectrum(-100), 0.5);
    feed(s, spectrum(-100, [[C3, -20], [C3 * 2, -24], [C3 * 7, -30], [midiToHz(67), -26]]), 0.2);
    for (const x of Array.from(s.extra)) expect(x).toBe(0);
  });
});

describe("stringVerdicts", () => {
  it("missing E for C major marks both strings that carry E (4 and 1)", () => {
    const v = stringVerdicts({ missing_notes: ["E"] }, stringTargets(C_MAJOR));
    expect(v).toEqual(["muted", "ok", "missing", "ok", "ok", "missing"]);
  });

  it("unclear notes are 'unclear', and a heard open low E on a muted string is 'extra'", () => {
    const v = stringVerdicts({ unclear_notes: ["G"], extra_notes: ["F"] }, stringTargets(C_MAJOR));
    expect(v[3]).toBe("unclear");
    expect(v[0]).toBe("muted");
    const w = stringVerdicts({ extra_notes: ["E"] }, stringTargets({ ...C_MAJOR, positions: C_MAJOR.positions }));
    expect(w[0]).toBe("extra");
  });

  it("pitchClass understands flats and octave suffixes", () => {
    expect(pitchClass("Eb")).toBe(3);
    expect(pitchClass("D#")).toBe(3);
    expect(pitchClass("F#3")).toBe(6);
    expect(pitchClass("x")).toBeNull();
  });
});
