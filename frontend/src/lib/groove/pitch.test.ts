import { describe, expect, it } from "vitest";
import { NoteTracker } from "./pitch";
import { LEAD_RIFFS, noteName, parseNote } from "./lead";
import { timeline } from "./groove";

/** A plucked-string-like tone: harmonics with decay. */
function tone(hz: number, sr: number, n: number, offset = 0): Float32Array {
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = (i + offset) / sr;
    const env = Math.exp(-t * 2);
    x[i] = env * (0.6 * Math.sin(2 * Math.PI * hz * t) + 0.3 * Math.sin(4 * Math.PI * hz * t) + 0.1 * Math.sin(6 * Math.PI * hz * t));
  }
  return x;
}

describe("lead notes", () => {
  it("parses string:fret", () => {
    expect(parseNote("2:3")).toEqual({ string: 2, fret: 3, midi: 62 });
    expect(noteName(62)).toBe("D4");
    expect(parseNote("7:0")).toBeNull();
  });

  it("hears each open string and a fretted note", () => {
    const sr = 48000, n = 2048;
    for (const [tok, hz] of [["6:0", 82.41], ["5:0", 110], ["1:0", 329.63], ["2:3", 293.66]] as const) {
      const tr = new NoteTracker(n);
      let got: number | null = null;
      for (let f = 0; f < 6 && got === null; f++) {
        const h = tr.feed(tone(hz, sr, n, f * 600), sr, f * 0.03);
        if (h) got = h.midi;
      }
      expect(got, tok).toBe(parseNote(tok)!.midi);
    }
  });

  it("a repeated note needs a new pluck", () => {
    const sr = 48000, n = 2048, tr = new NoteTracker(n);
    const hits: number[] = [];
    for (let f = 0; f < 10; f++) {
      const h = tr.feed(tone(329.63, sr, n, f * 600), sr, f * 0.03);
      if (h) hits.push(h.midi);
    }
    expect(hits).toEqual([64]); // ringing on doesn't count again
    tr.feed(new Float32Array(n), sr, 1); // silence between plucks
    let again = false;
    for (let f = 0; f < 4; f++) if (tr.feed(tone(329.63, sr, n, f * 600), sr, 1.1 + f * 0.03)) again = true;
    expect(again).toBe(true);
  });

  it("riffs: valid notes, repeated notes are separate, '-' holds", () => {
    for (const r of LEAD_RIFFS) for (const t of r.bars.flat()) expect(t === "-" || parseNote(t), `${r.id} ${t}`).toBeTruthy();
    const ode = timeline(LEAD_RIFFS.find((r) => r.id === "lead-ode")!);
    expect(ode.segments.slice(0, 2).map((s) => s.chord)).toEqual(["1:0", "1:0"]);
    expect(ode.segments[ode.segments.length - 1]).toMatchObject({ chord: "2:3", beats: 2 });
  });
});
