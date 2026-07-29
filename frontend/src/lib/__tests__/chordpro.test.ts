import { describe, it, expect } from "vitest";
import {
  parseChordPro,
  parseChord,
  transposeChord,
  simplifyChord,
  toAppChordKey,
  keyPrefersFlats,
  displayChord,
  mapChords,
  chordsInSheet,
  type DisplayOptions,
} from "../chordpro";

const SHEET = `{title: Test Song}
{artist: Someone}
{key: G}
{capo: 2}
{tempo: 96}
{difficulty: beginner}
{comment: Play gently}

{start_of_verse: Verse 1}
[G]Your own [C]words go [D]here
| G . . . | Em . D . | % |
{end_of_verse}

{soc}
[Cadd9]   [D/F#]
{eoc}

{start_of_tab: Riff}
e|---0---|
B|-1---1-|
{end_of_tab}
`;

const noop: DisplayOptions = { transpose: 0, capo: 2, flats: false, simplify: false };

describe("parseChordPro", () => {
  const sheet = parseChordPro(SHEET);

  it("reads metadata", () => {
    expect(sheet.meta).toMatchObject({
      title: "Test Song", artist: "Someone", key: "G", capo: 2, tempo: 96, difficulty: "beginner",
    });
  });

  it("splits sections with labels", () => {
    expect(sheet.sections.map((s) => [s.kind, s.label])).toEqual([
      ["other", null],
      ["verse", "Verse 1"],
      ["chorus", null],
      ["tab", "Riff"],
    ]);
  });

  it("puts chords over the following text", () => {
    const line = sheet.sections[1].lines[0];
    expect(line).toEqual({
      type: "lyrics",
      segments: [
        { chord: "G", text: "Your own " },
        { chord: "C", text: "words go " },
        { chord: "D", text: "here" },
      ],
    });
  });

  it("parses bar lines into beats", () => {
    expect(sheet.sections[1].lines[1]).toEqual({
      type: "bars",
      bars: [["G", ".", ".", "."], ["Em", ".", "D", "."], ["%"]],
    });
  });

  it("keeps tab lines verbatim", () => {
    expect(sheet.sections[3].lines).toEqual([
      { type: "tab", text: "e|---0---|" },
      { type: "tab", text: "B|-1---1-|" },
    ]);
  });

  it("lists distinct chords in order", () => {
    expect(chordsInSheet(sheet)).toEqual(["G", "C", "D", "Em", "Cadd9", "D/F#"]);
  });

  it("tolerates junk and Windows line endings", () => {
    const s = parseChordPro("{title: X}\r\n{unknown: y}\r\n# a comment\r\n[Am]la\r\n");
    expect(s.meta.title).toBe("X");
    expect(chordsInSheet(s)).toEqual(["Am"]);
  });
});

describe("chord maths", () => {
  it("parses roots, qualities and bass notes", () => {
    expect(parseChord("F#m7/C#")).toEqual({ root: "F#", quality: "m7", bass: "C#" });
    expect(parseChord("N.C.")).toBeNull();
    expect(parseChord(".")).toBeNull();
  });

  it("transposes with wraparound, bass notes and flats", () => {
    expect(transposeChord("G", 2)).toBe("A");
    expect(transposeChord("B", 1)).toBe("C");
    expect(transposeChord("C", -1)).toBe("B");
    expect(transposeChord("D/F#", 2)).toBe("E/G#");
    expect(transposeChord("A", 1, true)).toBe("Bb");
    expect(transposeChord("Bbmaj7", 2)).toBe("Cmaj7");
    expect(transposeChord("N.C.", 3)).toBe("N.C.");
  });

  it("simplifies to playable triads", () => {
    expect(simplifyChord("Cadd9")).toBe("C");
    expect(simplifyChord("Am7")).toBe("Am");
    expect(simplifyChord("Gsus4")).toBe("G");
    expect(simplifyChord("D/F#")).toBe("D");
    expect(simplifyChord("Cmaj7")).toBe("C");
    expect(simplifyChord("Bdim")).toBe("Bdim");
  });

  it("maps symbols to app lesson keys", () => {
    expect(toAppChordKey("G")).toBe("G_major");
    expect(toAppChordKey("F#m")).toBe("F#_minor");
    expect(toAppChordKey("Bb")).toBe("A#_major");
    expect(toAppChordKey("E7")).toBe("E_dominant7");
    expect(toAppChordKey("Cmaj7")).toBe("C_major7");
    expect(toAppChordKey("Dm7")).toBe("D_minor7");
    expect(toAppChordKey("A5")).toBe("A_power");
    expect(toAppChordKey("Bm7b5")).toBe("B_half_dim7");
    expect(toAppChordKey("Bø")).toBe("B_half_dim7");
    expect(toAppChordKey("Bdim7")).toBeNull(); // no fully-diminished lessons
    expect(toAppChordKey("Cadd9")).toBeNull();
  });

  it("knows which keys use flats", () => {
    expect(keyPrefersFlats("F")).toBe(true);
    expect(keyPrefersFlats("Bb major")).toBe(true);
    expect(keyPrefersFlats("D minor")).toBe(true);
    expect(keyPrefersFlats("G")).toBe(false);
    expect(keyPrefersFlats(null)).toBe(false);
  });
});

describe("display options", () => {
  const { meta } = parseChordPro(SHEET); // written for capo 2

  it("shows chords as written by default", () => {
    expect(displayChord("G", meta, noop)).toBe("G");
  });

  it("removing the capo shifts shapes up to keep the pitch", () => {
    expect(displayChord("G", meta, { ...noop, capo: 0 })).toBe("A");
  });

  it("transposes and simplifies together", () => {
    expect(displayChord("Cadd9", meta, { ...noop, transpose: 2, simplify: true })).toBe("D");
  });

  it("mapChords leaves beat marks alone", () => {
    const sheet = parseChordPro("| G . % |");
    const out = mapChords(sheet, (c) => transposeChord(c, 2));
    expect(out.sections[0].lines[0]).toEqual({ type: "bars", bars: [["A", ".", "%"]] });
  });
});
