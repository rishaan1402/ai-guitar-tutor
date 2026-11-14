import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fretString, prettySymbol, shapeFor, slashVoicing } from "./chordShape";
import type { FretPosition } from "./api";

const list = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "../../../data/chords/fingerings.json"), "utf8"),
) as { chord: string; positions: FretPosition[]; notes: string[] }[];
const data = Object.fromEntries(list.map((c) => [c.chord, c]));
const pos = (k: string) => data[k].positions;

const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const OPEN: Record<number, number> = { 1: 4, 2: 11, 3: 7, 4: 2, 5: 9, 6: 4 };
const lowest = (p: FretPosition[]) => {
  const s = p.filter((x) => x.action !== "mute").sort((a, b) => b.string - a.string)[0];
  return NOTES[(OPEN[s.string] + (s.fret ?? 0)) % 12];
};
const pcs = (p: FretPosition[]) =>
  new Set(p.filter((x) => x.action !== "mute").map((x) => NOTES[(OPEN[x.string] + (x.fret ?? 0)) % 12]));

describe("slashVoicing", () => {
  it.each([
    ["G_major", "B"],
    ["D_major", "F#"],
    ["C_major", "G"],
    ["C_major", "E"],
    ["A_minor", "G"],
  ])("%s over %s puts the bass lowest and keeps every chord tone", (key, bass) => {
    const v = slashVoicing(pos(key), bass);
    expect(v).not.toBeNull();
    expect(lowest(v!)).toBe(bass);
    for (const n of Array.from(pcs(pos(key)))) expect(pcs(v!).has(n)).toBe(true);
    expect(v!.filter((x) => x.fret && x.fret > 0 && x.action !== "mute").every((x) => x.finger)).toBe(true);
  });

  it("G/B is x2 0 0 0 3 style", () => {
    expect(fretString(slashVoicing(pos("G_major"), "B")!)).toMatch(/^x2/);
  });
});

describe("shapeFor", () => {
  it("captions with the symbol as written", () => {
    expect(shapeFor("G/B", pos("G_major")).caption).toBe("G/B");
    expect(shapeFor("Am", pos("A_minor"))).toEqual({ positions: pos("A_minor"), caption: "Am" });
  });
  it("notes plainly when no voicing exists", () => {
    const s = shapeFor("E/A#", pos("E_major"));
    if (s.note) expect(s.note).toContain("A#");
    else expect(lowest(s.positions)).toBe("A#");
  });
});

describe("helpers", () => {
  it("fretString", () => expect(fretString(pos("C_major"))).toBe("x32010"));
  it("prettySymbol", () => expect(prettySymbol("Bm7b5")).toBe("Bm7♭5"));
});

describe("every lesson fingering sounds exactly its notes", () => {
  it.each(Object.keys(data))("%s", (k) => {
    expect(Array.from(pcs(pos(k))).sort()).toEqual(Array.from(new Set(data[k].notes)).sort());
  });
});
