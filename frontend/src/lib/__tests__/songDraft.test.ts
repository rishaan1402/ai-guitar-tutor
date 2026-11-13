import { describe, it, expect } from "vitest";
import { lessonToChordPro, normalizeKey } from "../songDraft";
import { parseChordPro, chordsInSheet } from "../chordpro";
import type { LessonDocument } from "../api";

const lesson = {
  song_title: "Some Song {weird}",
  artist: "Some Band",
  key: "E minor",
  time_signature: "4/4",
  overall_difficulty: "Beginner",
  song_sections: [
    { name: "Verse", chords: ["Em", "C", "G", "D", "Em"] },
    { name: "Chorus", chords: ["C", "G"] },
    { name: "Empty", chords: [] },
  ],
} as unknown as LessonDocument;

describe("normalizeKey", () => {
  it("shortens spelled-out keys", () => {
    expect(normalizeKey("G major")).toBe("G");
    expect(normalizeKey("E minor")).toBe("Em");
    expect(normalizeKey("F# Minor")).toBe("F#m");
    expect(normalizeKey("Bb")).toBe("Bb");
    expect(normalizeKey("")).toBeNull();
  });
});

describe("lessonToChordPro", () => {
  const text = lessonToChordPro(lesson);
  const sheet = parseChordPro(text);

  it("round-trips through the parser", () => {
    expect(sheet.meta.title).toBe("Some Song  weird");
    expect(sheet.meta.key).toBe("Em");
    expect(sheet.meta.difficulty).toBe("beginner");
    expect(chordsInSheet(sheet)).toEqual(["Em", "C", "G", "D"]);
  });

  it("makes one section per lesson section, four bars per line, skipping empty ones", () => {
    const sections = sheet.sections.filter((s) => s.kind !== "other");
    expect(sections.map((s) => [s.kind, s.label])).toEqual([["verse", "Verse"], ["chorus", "Chorus"]]);
    const verseBars = sections[0].lines.filter((l) => l.type === "bars");
    expect(verseBars.map((l) => (l.type === "bars" ? l.bars.length : 0))).toEqual([4, 1]);
  });
});
