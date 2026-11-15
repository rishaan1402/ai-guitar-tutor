import { describe, expect, it } from "vitest";
import { notes, pcs, sessionStars, starsFor, targetMatches } from "./steps";
import { makeRound, INTERVALS } from "./ear";
import { planRhythm, scoreTaps } from "./rhythm";

describe("lesson steps", () => {
  it("reads tab tokens as exact notes, with bends and harmonics", () => {
    expect(notes("6:0 5:3 1:12")[0].midi).toBe(40);
    expect(notes("5:3")[0].midi).toBe(48); // C3
    expect(notes("3:7b2")[0].midi).toBe(64); // D bent to E
    expect(notes("6:12h 6:7h 6:5h").map((n) => n.midi)).toEqual([52, 59, 64]);
    expect(() => notes("7:1")).toThrow();
  });
  it("pitch-class targets match any octave", () => {
    const [c] = pcs("C");
    expect(targetMatches(c, 48)).toBe(true);
    expect(targetMatches(c, 72)).toBe(true);
    expect(targetMatches(c, 50)).toBe(false);
  });
  it("stars: average of scored steps, skipped check caps at 2", () => {
    expect(starsFor(1)).toBe(3);
    expect(starsFor(0.5)).toBe(1);
    expect(sessionStars([3, 2, 3], false)).toBe(3);
    expect(sessionStars([], false)).toBe(3);
    expect(sessionStars([], true)).toBe(2);
    expect(sessionStars([0, 0], false)).toBe(1);
  });
});

describe("ear training", () => {
  it("plays the interval it asks about", () => {
    const r = makeRound("interval", ["perfect 5th"], () => 0);
    expect(r.notes[1] - r.notes[0]).toBe(INTERVALS["perfect 5th"]);
    const h = makeRound("higher", ["second"], () => 0.3);
    expect(h.notes[1]).toBeGreaterThan(h.notes[0]);
  });
});

describe("rhythm", () => {
  it("plans eighths and scores taps", () => {
    const p = planRhythm("x.x.x.x.", 60, 1);
    expect(p.hits).toEqual([0, 1, 2, 3]);
    const s = scoreTaps(p.hits, [0.02, 1.0, 2.3, 3.05]);
    expect(s.errors).toEqual([20, 0, null, 50]);
    expect(s.extra).toBe(1);
    expect(s.share).toBeCloseTo(0.625);
  });
});
