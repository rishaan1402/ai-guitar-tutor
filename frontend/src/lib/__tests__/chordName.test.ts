import { describe, it, expect } from "vitest";
import { BEGINNER_PATH, formatChord, nextBeginnerChord } from "../chordName";

describe("formatChord", () => {
  it("replaces every underscore", () => {
    expect(formatChord("A#_half_dim7")).toBe("A# half dim7");
    expect(formatChord("C_major")).toBe("C major");
  });
  it("handles empty input", () => {
    expect(formatChord("")).toBe("");
    expect(formatChord(null)).toBe("");
  });
});

describe("nextBeginnerChord", () => {
  it("walks the beginner path", () => {
    expect(nextBeginnerChord("E_minor")).toBe("A_minor");
    expect(nextBeginnerChord("C_major")).toBe("D_minor");
  });
  it("wraps and handles off-path chords", () => {
    expect(nextBeginnerChord(BEGINNER_PATH[BEGINNER_PATH.length - 1])).toBe("E_minor");
    expect(nextBeginnerChord("F#_dominant7")).toBe("E_minor");
  });
});

import { chordSymbol } from "../chordName";

describe("chordSymbol", () => {
  it("keeps case and uses standard symbols", () => {
    expect(chordSymbol("E_minor")).toBe("Em");
    expect(chordSymbol("A_major")).toBe("A");
    expect(chordSymbol("C_major7")).toBe("Cmaj7");
    expect(chordSymbol("A#_half_dim7")).toBe("A#m7♭5");
    expect(chordSymbol("G_power")).toBe("G5");
    expect(chordSymbol("D_dominant7")).toBe("D7");
  });
});
