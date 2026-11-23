import { describe, expect, it } from "vitest";
import { transposeGroove, type Groove } from "./groove";
import { transposeChord } from "@/lib/chordpro";

const g: Groove = { id: "t", title: "T", style: "pop", bpm: 90, bars: [["G"], ["D", "Em"], ["C/G"]], strum: "D.DU.UDU", loops: 1, focus: ["G", "D"] };

describe("transposeGroove", () => {
  it("moves every chord and the focus change, keeps the rest", () => {
    const up = transposeGroove(g, 2, transposeChord);
    expect(up.bars).toEqual([["A"], ["E", "F#m"], ["D/A"]]);
    expect(up.focus).toEqual(["A", "E"]);
    expect(up.bpm).toBe(90);
    expect(transposeGroove(g, 0, transposeChord)).toBe(g);
  });
  it("leaves lead lines alone", () => {
    const lead: Groove = { ...g, kind: "lead", bars: [["2:3", "-"]] };
    expect(transposeGroove(lead, 3, transposeChord)).toBe(lead);
  });
});
