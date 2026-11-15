/**
 * Just enough music theory for Grooves: the pitch classes in a chord symbol,
 * and MIDI notes for the backing band to voice it.
 */
import { parseChord } from "../chordpro";

const NOTE_PC: Record<string, number> = {
  C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6,
  G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11, Cb: 11, Fb: 4,
};

/** Intervals (semitones above the root) for the chord qualities the app teaches, plus common extras. */
const QUALITY: Record<string, number[]> = {
  "": [0, 4, 7],
  m: [0, 3, 7],
  "7": [0, 4, 7, 10],
  maj7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10],
  m7b5: [0, 3, 6, 10],
  "5": [0, 7],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  add9: [0, 4, 7, 2],
  dim: [0, 3, 6],
  aug: [0, 4, 8],
  "6": [0, 4, 7, 9],
  m6: [0, 3, 7, 9],
};

export interface ChordNotes {
  symbol: string;
  root: number;
  /** Pitch classes, root first. */
  pcs: number[];
}

export function chordNotes(symbol: string): ChordNotes | null {
  const c = parseChord(symbol);
  if (!c) return null;
  const root = NOTE_PC[c.root];
  const iv = QUALITY[c.quality] ?? (c.quality.startsWith("m") && !c.quality.startsWith("maj") ? QUALITY.m : QUALITY[""]);
  if (root === undefined) return null;
  const pcs = iv.map((i) => (root + i) % 12);
  const bass = c.bass ? NOTE_PC[c.bass] : undefined;
  return { symbol, root: bass ?? root, pcs };
}

/** MIDI note of pitch class `pc` in the octave starting at `lowMidi` (inclusive). */
export function midiInOctave(pc: number, lowMidi: number): number {
  return lowMidi + ((pc - (lowMidi % 12) + 12) % 12);
}

export const midiToHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
