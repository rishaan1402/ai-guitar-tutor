import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { parseSymbol, QUALITIES } from "./quality";
import { bestVoicings, buildFingering, fretString } from "./voicing";

const OPEN: Record<number, number> = { 6: 40, 5: 45, 4: 50, 3: 55, 2: 59, 1: 64 };
const shape = (s: string) => fretString(bestVoicings(parseSymbol(s)!)!.first.frets);

describe("chord symbols", () => {
  it("reads roots, types, aliases and slash chords", () => {
    expect(parseSymbol("F#m7b5")!.noteNames).toEqual(["F#", "A", "C", "E"]);
    expect(parseSymbol("Bbmaj7")!.noteNames).toEqual(["Bb", "D", "F", "A"]);
    expect(parseSymbol("C6/9")!.quality.id).toBe("69");
    expect(parseSymbol("Asus")!.quality.id).toBe("sus4");
    expect(parseSymbol("Gm(maj7)")!.quality.id).toBe("mmaj7");
    expect(parseSymbol("CMaj7")!.quality.id).toBe("maj7");
    expect(parseSymbol("C2")!.quality.id).toBe("add9");
    const gb = parseSymbol("G/B")!;
    expect(gb.bass).toBe(11);
    expect(parseSymbol("D/F#")!.bassName).toBe("F#");
    expect(parseSymbol("Hm")).toBeNull();
    expect(parseSymbol("Cxyz")).toBeNull();
  });
});

describe("shape finder", () => {
  it("finds the classic open shapes", () => {
    expect(shape("C")).toBe("x32010");
    expect(shape("G")).toBe("320003");
    expect(shape("D")).toBe("xx0232");
    expect(shape("A")).toBe("x02220");
    expect(shape("E")).toBe("022100");
    expect(shape("Am")).toBe("x02210");
    expect(shape("Em")).toBe("022000");
    expect(shape("Dm")).toBe("xx0231");
  });

  it("every shape for every chord type and root sounds only chord tones, has the right bass, and is playable", () => {
    const roots = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
    let built = 0;
    for (const r of roots) {
      for (const qu of QUALITIES) {
        const sym = r + qu.id;
        const spec = parseSymbol(sym)!;
        const best = bestVoicings(spec);
        expect(best, `${sym} has a shape`).toBeTruthy();
        const v = best!.first;
        const played = v.frets.map((f, i) => (f >= 0 ? OPEN[6 - i] + f : null)).filter((m): m is number => m !== null);
        for (const m of played) expect(spec.pcs, `${sym} ${fretString(v.frets)}`).toContain(m % 12);
        expect(Math.min(...played) % 12, `${sym} bass`).toBe(spec.root);
        for (const req of spec.required) expect(played.map((m) => m % 12), `${sym} has ${req}`).toContain(req);
        expect(Math.max(...v.fingers)).toBeLessThanOrEqual(4);
        built++;
      }
    }
    expect(built).toBe(12 * QUALITIES.length);
  });

  it("slash chords put the bass note lowest", () => {
    expect(shape("G/B")).toMatch(/^x2/);
    expect(shape("D/F#")).toMatch(/^2/);
    expect(shape("Ebm/Gb")).toBeTruthy();
  });

  it("builds every chord in the lesson library", () => {
    const lib = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../../../data/chords/fingerings.json"), "utf8")) as { display_name: string }[];
    for (const c of lib) expect(buildFingering(c.display_name), c.display_name).toBeTruthy();
  });

  it("fingering has positions for all six strings in library format", () => {
    const f = buildFingering("Cadd9")!;
    expect(f.positions).toHaveLength(6);
    expect(f.notes).toEqual(["C", "E", "G", "D"]);
  });
});

describe("familiar shapes", () => {
  it("common song chords use the shapes guitarists teach", () => {
    expect(shape("Cadd9")).toBe("x32033");
    expect(shape("G/B")).toBe("x20033");
    expect(shape("D/F#")).toBe("200232");
    expect(shape("Bm")).toBe("x24432");
    expect(shape("Dsus4")).toBe("xx0233");
    expect(shape("Em7")).toBe("022030");
  });
});

describe("common-shape table", () => {
  it("every table shape passes the same checks as a search result", async () => {
    const { COMMON, fromTable } = await import("./voicing");
    for (const sym of Object.keys(COMMON)) expect(fromTable(parseSymbol(sym)!), `${sym} ${COMMON[sym]}`).toBeTruthy();
  });
});

describe("hearing colour chords", () => {
  it("a colour chord counts when its core is heard; different cores never do", async () => {
    const { matchesExpected } = await import("../groove/detect");
    expect(matchesExpected("C", "Cadd9")).toBe(true);
    expect(matchesExpected("Am", "Am9")).toBe(true);
    expect(matchesExpected("E", "Emaj7")).toBe(true);
    expect(matchesExpected("D", "Dsus4")).toBe(false);
    expect(matchesExpected("Dsus4", "Dsus4")).toBe(true);
    expect(matchesExpected("C", "C/G")).toBe(false);
    expect(matchesExpected("Am", "A")).toBe(false);
    expect(matchesExpected("Bdim", "Bm")).toBe(false);
  });
});

describe("spelling", () => {
  it("spells notes the way musicians write them", () => {
    expect(parseSymbol("C9")!.noteNames).toEqual(["C", "E", "G", "Bb", "D"]);
    expect(parseSymbol("Cm")!.noteNames).toEqual(["C", "Eb", "G"]);
    expect(parseSymbol("E7#9")!.noteNames).toEqual(["E", "G#", "B", "D", "G"]);
    expect(parseSymbol("F#m7")!.noteNames).toEqual(["F#", "A", "C#", "E"]);
    expect(parseSymbol("Caug")!.noteNames).toEqual(["C", "E", "G#"]);
    expect(parseSymbol("G/B")!.noteNames).toEqual(["G", "B", "D"]);
  });
});
