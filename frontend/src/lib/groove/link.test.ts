import { describe, expect, it } from "vitest";
import { decodeGroove, encodeGroove } from "./link";
import { PRESET_GROOVES } from "./groove";

describe("groove links", () => {
  it("round-trips a groove", () => {
    const g = { ...PRESET_GROOVES[1], source: "ai" };
    expect(decodeGroove(encodeGroove(g))).toMatchObject({ title: g.title, bars: g.bars, bpm: g.bpm, focus: g.focus, source: "ai" });
  });
  it("rejects junk and unplayable chords", () => {
    expect(decodeGroove("not-base64!!")).toBeNull();
    expect(decodeGroove(encodeGroove({ ...PRESET_GROOVES[0], bars: [["Xyz"]] }))).toBeNull();
    expect(decodeGroove(encodeGroove({ ...PRESET_GROOVES[0], bpm: 900 }))).toBeNull();
  });
});
