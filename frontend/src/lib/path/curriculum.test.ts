import { describe, expect, it } from "vitest";
import { ALL_SESSIONS, chordsUpTo, nextSession, sessionAfter, TRACKS } from "./curriculum";
import { timeline, strumSlots, barBeats } from "../groove/groove";
import { chordNotes } from "../groove/theory";
import { chordTemplate } from "../groove/detect";
import { parseNote } from "../groove/lead";
import { toAppChordKey } from "../chordpro";

describe("curriculum", () => {
  it("is deep: four tracks and over a hundred sessions", () => {
    expect(TRACKS.map((t) => t.id)).toEqual(["chords", "lead", "theory", "styles"]);
    expect(ALL_SESSIONS.length).toBeGreaterThanOrEqual(100);
  });

  it("every session has steps and every quiz answer exists", () => {
    for (const s of ALL_SESSIONS) {
      expect(s.steps.length, s.id).toBeGreaterThan(0);
      for (const st of s.steps) {
        if (st.kind === "quiz") for (const qn of st.questions) expect(qn.options[qn.answer], `${s.id}: ${qn.q}`).toBeDefined();
        if (st.kind === "learn") expect(toAppChordKey(st.chord), `${s.id}: ${st.chord} has a lesson`).toBeTruthy();
        if (st.kind === "play") expect(st.targets.length, s.id).toBeGreaterThan(0);
        if (st.kind === "rhythm") expect([6, 8, 12, 16]).toContain(st.pattern.length);
        if (st.kind === "ear") expect(st.options.length).toBeGreaterThan(1);
      }
    }
  });

  it("every Groove is playable: chords are detectable, notes are on the neck", () => {
    for (const s of ALL_SESSIONS) {
      const known = new Set(chordsUpTo(s.id));
      for (const st of s.steps) {
        if (st.kind !== "groove") continue;
        const gr = st.groove;
        expect(timeline(gr).changes.length, `${s.id} has changes`).toBeGreaterThan(0);
        expect(strumSlots(gr.strum, barBeats(gr) * 2)).toHaveLength(barBeats(gr) * 2);
        for (const c of gr.bars.flat()) {
          if (c === "-") continue;
          if (gr.kind === "lead") {
            expect(parseNote(c), `${s.id}: ${c}`).toBeTruthy();
            continue;
          }
          expect(chordNotes(c), `${s.id}: ${c}`).toBeTruthy();
          expect(chordTemplate(c), `${s.id}: ${c} detectable`).toBeTruthy();
          // in the chords track, songs only use chords already taught
          if (s.id.match(/^(b1|b2|c3|c5|c6|c7)-/)) expect(known.has(c), `${s.id}: ${c} not taught yet`).toBe(true);
        }
      }
    }
  });

  it("ids are unique and valid for the API", () => {
    const ids = ALL_SESSIONS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]{2,40}$/);
    const grooveIds = ALL_SESSIONS.flatMap((s) => s.steps.flatMap((st) => (st.kind === "groove" ? [st.groove.id] : [])));
    expect(new Set(grooveIds).size).toBe(grooveIds.length);
  });

  it("next session is the first without stars, per track", () => {
    expect(nextSession({}).id).toBe("b1-start");
    expect(nextSession({ "b1-start": 3, "b1-em": 3, "b1-am": 1 }).id).toBe("b1-e");
    expect(nextSession({}, "lead").id).toBe("l1-open");
    expect(sessionAfter("l1-melodies")?.id).toBe("l2-alt");
  });
});

describe("newer exercises in the curriculum", () => {
  it("ladders, echoes, jams, fretboard games and progression drills are all valid", async () => {
    const { voiceProgression } = await import("./ear");
    const kinds = new Set<string>();
    for (const s of ALL_SESSIONS) {
      for (const st of s.steps) {
        kinds.add(st.kind);
        if (st.kind === "ladder") {
          expect(st.target, s.id).toBeGreaterThan(st.start);
          expect(timeline(st.groove).changes.length, s.id).toBeGreaterThan(0);
          for (const c of st.groove.bars.flat()) if (c !== "-") expect(st.groove.kind === "lead" ? parseNote(c) : chordTemplate(c), `${s.id}: ${c}`).toBeTruthy();
        }
        if (st.kind === "echo") for (const ph of st.phrases) expect(ph.length, s.id).toBeGreaterThanOrEqual(2);
        if (st.kind === "improvise") {
          for (const c of st.bars.flat()) expect(chordNotes(c), `${s.id}: ${c}`).toBeTruthy();
          expect(st.scalePcs, s.id).toContain(st.homePc);
        }
        if (st.kind === "fretgame") expect(st.frets[1]).toBeGreaterThan(st.frets[0]);
        if (st.kind === "ear" && st.mode === "progression") for (const o of st.options) expect(voiceProgression(o, 0), `${s.id}: ${o}`).toBeTruthy();
      }
    }
    for (const k of ["echo", "ladder", "improvise", "fretgame"]) expect(kinds.has(k), k).toBe(true);
  });
});
