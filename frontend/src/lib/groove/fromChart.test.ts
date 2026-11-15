import { describe, expect, it } from "vitest";
import { parseChordPro } from "../chordpro";
import { easyChord, sectionBars, songGrooves, strumFrom } from "./fromChart";

const CHART = `{title: Test Song}
{tempo: 96}
{strumming: D DU UDU}
{start_of_grid: Verse}
| G . . . | D/F# . . . | Em . . . | Cadd9 . . . |
| % | D . G . |
{end_of_grid}
{start_of_chorus: Chorus}
[C]Words [G]here [Am7]and [F]there
{end_of_chorus}`;

describe("chart to grooves", () => {
  const sheet = parseChordPro(CHART);
  it("reads bars, repeats and lyric chords", () => {
    expect(sectionBars(sheet.sections[0])).toEqual([["G"], ["D/F#"], ["Em"], ["Cadd9"], ["Cadd9"], ["D", "G"]]);
    expect(sectionBars(sheet.sections[1])).toEqual([["C"], ["G"], ["Am7"], ["F"]]);
  });
  it("makes a groove per section plus the whole song, playable chords only", () => {
    const gs = songGrooves(sheet);
    expect(gs.map((g) => g.label)).toEqual(["Whole song", "Verse", "Chorus"]);
    expect(gs[1].groove.bars).toEqual([["G"], ["D"], ["Em"], ["Cadd9"], ["Cadd9"], ["D", "G"]]);
    expect(gs[0].groove).toMatchObject({ bpm: 96, strum: "D.DU.UDU", mode: "follow", source: "song" });
  });
  it("easy version swaps chords you don't know for close ones you do", () => {
    const known = new Set(["G", "D", "Em", "C", "Am"]);
    expect(easyChord("Cadd9", known)).toBe("C");
    expect(easyChord("Am7", known)).toBe("Am");
    expect(easyChord("F", known)).toBe("Am"); // F A C vs A C E: two shared notes
    const easy = songGrooves(sheet, { known, easy: true });
    expect(easy[2].groove.bars.flat()).toEqual(["C", "G", "Am", "Am"]);
    expect(easy[2].changed).toContain("F→Am");
  });
  it("strum text", () => {
    expect(strumFrom("D - D U - U D U")).toBe("D.DU.UDU");
    expect(strumFrom("D DU UDU")).toBe("D.DU.UDU");
    expect(strumFrom("")).toBe("D.DU.UDU");
  });
});
