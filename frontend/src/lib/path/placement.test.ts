import { describe, expect, it } from "vitest";
import { probesFor, probePassed, testedOut } from "./placement";
import { buildReview, canReview, reviewId } from "./review";
import { nextSession, TRACKS } from "./curriculum";

describe("placement", () => {
  it("has a probe for every level, with at most three questions", () => {
    for (const t of TRACKS) {
      const probes = probesFor(t.id);
      expect(probes).toHaveLength(t.levels.length);
      for (const p of probes) expect(p.questions.length).toBeLessThanOrEqual(3);
    }
    expect(probesFor("chords")[0].questions.length).toBeGreaterThan(0);
  });
  it("passing allows one mistake; self-reports pass on yes", () => {
    expect(probePassed(3, 3)).toBe(true);
    expect(probePassed(2, 3)).toBe(true);
    expect(probePassed(1, 3)).toBe(false);
    expect(probePassed(1, 0)).toBe(true);
    expect(probePassed(0, 0)).toBe(false);
  });
  it("starts 'up next' at the placed level and marks earlier levels tested out", () => {
    expect(nextSession({}, "chords", "chords-5").id).toBe(TRACKS[0].levels.find((l) => l.id === "chords-5")!.sessions[0].id);
    expect(testedOut("chords", "basics-1", { chords: "chords-5" })).toBe(true);
    expect(testedOut("chords", "chords-5", { chords: "chords-5" })).toBe(false);
    expect(testedOut("lead", "lead-1", { chords: "chords-5" })).toBe(false);
  });
});

describe("daily review", () => {
  const done = { "b1-em": 3, "b1-am": 1, "b1-e": 2, "b2-count": 3, "t1-fretgame": 2, "c3-strum": 1 };
  it("needs a few finished lessons", () => {
    expect(canReview({ "b1-em": 3 })).toBe(false);
    expect(buildReview({ "b1-em": 3 }, "2026-11-21")).toBeNull();
  });
  it("mixes a weak Groove, a weak drill, recall questions and the fretboard game; same all day", () => {
    const r = buildReview(done, "2026-11-21")!;
    expect(r.id).toBe(reviewId("2026-11-21"));
    expect(r.id).toMatch(/^[a-z0-9-]{2,40}$/);
    const kinds = r.steps.map((s) => s.kind);
    expect(kinds[0]).toBe("read");
    expect(kinds).toContain("groove");
    expect(kinds).toContain("quiz");
    expect(kinds).toContain("fretgame");
    expect(JSON.stringify(buildReview(done, "2026-11-21"))).toBe(JSON.stringify(r));
  });
});
