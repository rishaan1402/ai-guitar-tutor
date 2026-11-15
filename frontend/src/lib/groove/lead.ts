/**
 * Lead: single notes on the highway, written string:fret ("2:3" = B string, 3rd fret).
 * Starter riffs are original or public-domain melodies.
 */
import type { Groove } from "./groove";

const OPEN_MIDI: Record<number, number> = { 6: 40, 5: 45, 4: 50, 3: 55, 2: 59, 1: 64 };
const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
export const STRING_NAMES: Record<number, string> = { 6: "E", 5: "A", 4: "D", 3: "G", 2: "B", 1: "e" };

export interface LeadNote {
  string: number;
  fret: number;
  midi: number;
}

export function parseNote(token: string): LeadNote | null {
  const m = /^([1-6]):(\d{1,2})$/.exec(token);
  if (!m) return null;
  const string = Number(m[1]), fret = Number(m[2]);
  if (fret > 15) return null;
  return { string, fret, midi: OPEN_MIDI[string] + fret };
}

export function noteName(midi: number): string {
  return NAMES[((midi % 12) + 12) % 12] + (Math.floor(midi / 12) - 1);
}

const lead = (id: string, title: string, bars: string[][], o: Partial<Groove> = {}): Groove => ({
  kind: "lead", id, title, style: "ballad", bpm: 60, bars, strum: "........", loops: 2, ...o,
});

export const LEAD_RIFFS: Groove[] = [
  lead("lead-open", "Open strings warm-up", [["6:0", "5:0"], ["4:0", "3:0"], ["2:0", "1:0"], ["2:0", "3:0"]], {
    tip: "Pluck one string at a time with a pick or your thumb; let each ring.", bpm: 56,
  }),
  lead("lead-night", "Night Drive riff", [["6:0", "6:3", "6:5", "6:3"], ["6:0", "-", "5:0", "5:2"]], {
    style: "rock", bpm: 64, tip: "Fret with fingertips: 1st finger can stay near the 3rd fret.",
  }),
  lead("lead-ode", "Ode to Joy (Beethoven)", [["1:0", "1:0", "1:1", "1:3"], ["1:3", "1:1", "1:0", "2:3"], ["2:1", "2:1", "2:3", "1:0"], ["1:0", "2:3", "2:3", "-"]], {
    bpm: 60, loops: 1, tip: "Only the top two strings. Index on fret 1, ring finger on fret 3.",
  }),
  lead("lead-twinkle", "Twinkle Twinkle (traditional)", [["2:1", "2:1", "1:3", "1:3"], ["1:5", "1:5", "1:3", "-"], ["1:1", "1:1", "1:0", "1:0"], ["2:3", "2:3", "2:1", "-"]], {
    style: "folk", bpm: 62, loops: 1, tip: "Fret 5 on the high e is your pinky; keep your hand over frets 1 to 5.",
  }),
];
