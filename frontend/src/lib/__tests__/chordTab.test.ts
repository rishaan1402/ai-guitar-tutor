import { describe, expect, it } from "vitest";
import { chordTab, stringFrets } from "../chordTab";
import { chordsInSheet, displayChord, mapChords, parseChordPro } from "../chordpro";
import { changesHref } from "@/components/SongCouncil/ChartStage";
import { pairFromParams } from "@/components/TransitionTrainer";

const G = [
  { string: 6, fret: 3 }, { string: 5, fret: 2 }, { string: 4, fret: 0 },
  { string: 3, fret: 0 }, { string: 2, fret: 0 }, { string: 1, fret: 3 },
];
const C = [
  { string: 6, action: "mute" }, { string: 5, fret: 3 }, { string: 4, fret: 2 },
  { string: 3, fret: 0 }, { string: 2, fret: 1 }, { string: 1, fret: 0 },
];
const D = [
  { string: 6, action: "mute" }, { string: 5, action: "mute" }, { string: 4, fret: 0 },
  { string: 3, fret: 2 }, { string: 2, fret: 3 }, { string: 1, fret: 2 },
];

describe("chordTab", () => {
  it("strum shows every string, muted as x, high e first", () => {
    expect(chordTab(C, "strum")).toEqual([
      "e|--0--|", "B|--1--|", "G|--0--|", "D|--2--|", "A|--3--|", "E|--x--|",
    ]);
  });

  it("arpeggio starts on the lowest played string and climbs", () => {
    // C: bass A string (3), then D G B, back G D -> 6 columns
    const tab = chordTab(C, "arpeggio");
    expect(tab[4]).toBe("A|-3-----------|");     // bass on the first column only
    expect(tab[3]).toBe("D|---2-------2-|");     // up and back down
    expect(tab[2]).toBe("G|-----0---0---|");
    expect(tab[1]).toBe("B|-------1-----|");     // top of the climb
    expect(tab[0]).toBe("e|-------------|");     // high e not in this pattern
    expect(tab[5]).toBe("E|-------------|");     // muted string never played
  });

  it("D never plays the muted A and low E", () => {
    for (const p of ["strum", "arpeggio", "travis"] as const) {
      const tab = chordTab(D, p);
      expect(tab[4]).not.toMatch(/[0-9]/);
      expect(tab[5]).not.toMatch(/[0-9]/);
    }
  });

  it("every line in a tab has the same width", () => {
    for (const p of ["strum", "arpeggio", "travis"] as const) {
      const widths = new Set(chordTab(G, p).map((l) => l.length));
      expect(widths.size).toBe(1);
    }
  });

  it("missing strings count as muted", () => {
    expect(stringFrets([{ string: 4, fret: 0 }]).filter((s) => s.fret !== null)).toHaveLength(1);
  });
});

describe("AI chart in the sheet player", () => {
  // shape produced by backend council/chart.py
  const chart = [
    "{title: Test Song}", "{artist: Test Artist}", "{key: G}", "{capo: 2}", "{tempo: 100}",
    "{time: 4/4}", "{strumming: D DU UDU}", "{comment: Form: Verse → Chorus}", "",
    "{start_of_grid: Verse}", "| G . . . | D . . . | Em . . . | C . . . |", "{comment: Play 2×}", "{end_of_grid}",
    "", "{start_of_grid: Chorus}", "| C . G . | Am7 . . . | D . . . |", "{end_of_grid}",
  ].join("\n");

  it("parses meta, sections and chords", () => {
    const sheet = parseChordPro(chart);
    expect(sheet.meta.capo).toBe(2);
    expect(sheet.meta.strumming).toBe("D DU UDU");
    // the "Form: …" comment sits in an unlabelled block above the first section
    expect(sheet.sections.map((s) => s.label)).toEqual([null, "Verse", "Chorus"]);
    expect(chordsInSheet(sheet)).toEqual(["G", "D", "Em", "C", "Am7"]);
  });

  it("transposes, moves the capo and simplifies the chart's chords", () => {
    const sheet = parseChordPro(chart);
    const noCapo = mapChords(sheet, (c) => displayChord(c, sheet.meta, { transpose: 0, capo: 0, flats: false, simplify: true }));
    // capo 2 shapes played without a capo sound 2 semitones up; Am7 simplified to Am -> Bm
    expect(chordsInSheet(noCapo)).toEqual(["A", "E", "F#m", "D", "Bm"]);
  });
});

describe("section lesson links", () => {
  it("links a change to the trainer only when both chords have lessons", () => {
    expect(changesHref({ from_key: "G_major", to_key: "E_minor", from_symbol: "G", to_symbol: "Em" }))
      .toBe("/practice?mode=transitions&a=G_major&b=E_minor&sa=G&sb=Em");
    expect(changesHref({ from_key: "G_major", to_key: null, from_symbol: "G", to_symbol: "Gsus4" })).toBeNull();
  });

  it("trainer reads the pair back and rejects junk", () => {
    const q = (s: string) => new URLSearchParams(s);
    const ok = q("a=G_major&b=E_minor&sa=G&sb=Em");
    expect(pairFromParams((k) => ok.get(k))).toEqual({ keyA: "G_major", keyB: "E_minor", symbolA: "G", symbolB: "Em" });
    const bad = q("a=<script>&b=E_minor");
    expect(pairFromParams((k) => bad.get(k))).toBeNull();
    const same = q("a=G_major&b=G_major");
    expect(pairFromParams((k) => same.get(k))).toBeNull();
    const badSym = q("a=G_major&b=E_minor&sa=<b>");
    expect(pairFromParams((k) => badSym.get(k))?.symbolA).toBe("G");
  });
});
