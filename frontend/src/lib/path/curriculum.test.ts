import { describe, expect, it } from "vitest";
import { ALL_SESSIONS, chordsUpTo, LEVELS, nextSession } from "./curriculum";
import { timeline } from "../groove/groove";
import { chordNotes } from "../groove/theory";
import { toAppChordKey } from "../chordpro";

describe("curriculum", () => {
  it("every Groove and gig only uses chords taught by then, and every chord has a lesson", () => {
    for (const s of ALL_SESSIONS) {
      const known = new Set(chordsUpTo(s.id));
      for (const g of [s.practice, s.gig].filter(Boolean)) {
        if (g!.kind === "lead") continue; // notes, checked in pitch.test
        for (const c of g!.bars.flat()) {
          expect(known.has(c), `${s.id}: ${c} not taught yet`).toBe(true);
          expect(chordNotes(c), c).toBeTruthy();
        }
        expect(timeline(g!).changes.length, `${s.id} has changes`).toBeGreaterThan(0);
      }
      for (const c of s.newChords) expect(toAppChordKey(c), `${c} has a lesson`).toBeTruthy();
    }
  });
  it("ids are unique and valid for the API", () => {
    const ids = ALL_SESSIONS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]{2,40}$/);
  });
  it("next session is the first without stars", () => {
    expect(nextSession({}).id).toBe(LEVELS[0].sessions[0].id);
    expect(nextSession({ "b1-em": 3, "b1-am": 1 }).id).toBe("b1-e");
  });
});
