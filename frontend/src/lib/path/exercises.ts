/**
 * The logic behind the newer lesson exercises, kept pure so it's testable:
 * play-it-back matching, strum onsets from the mic, the speed ladder,
 * improvisation scoring and the fretboard game.
 */
import { starsFor, targetMatches, type Target } from "./steps";

/* ------------------------------------------------------------------ play it back */

/** Matches the notes you play against a phrase, in order. Octaves count (ears hear the note, not the octave). */
export class PhraseMatcher {
  i = 0;
  misses = 0;
  constructor(public targets: Target[], private anyOctave = true) {}

  get done() {
    return this.i >= this.targets.length;
  }

  /** One heard note: "hit" (next note of the phrase), "miss", or "done". */
  feed(midi: number): "hit" | "miss" | "done" {
    if (this.done) return "done";
    const t = this.targets[this.i];
    const ok = this.anyOctave && t.midi !== undefined ? ((t.midi - midi) % 12 + 12) % 12 === 0 : targetMatches(t, midi);
    if (ok) {
      this.i++;
      return this.done ? "done" : "hit";
    }
    this.misses++;
    return "miss";
  }

  reset() {
    this.i = 0;
  }
}

/** Stars for a set of phrases from the wrong notes along the way. */
export function echoStars(notes: number, misses: number): number {
  return starsFor(notes / Math.max(notes, notes + misses * 0.75));
}

/* ------------------------------------------------------------------ strum onsets */

/**
 * Finds strums in a mic stream: a sudden rise in loudness above the room's
 * level. One onset per strum (a short lockout stops the ringing from counting twice).
 */
export class OnsetDetector {
  private floor = 0.002;
  private prev = 0;
  private last = -1;
  constructor(private lockout = 0.09, private ratio = 2.2, private minLevel = 0.012) {}

  feed(samples: Float32Array, time: number): number | null {
    let sum = 0;
    for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
    return this.feedLevel(Math.sqrt(sum / samples.length), time);
  }

  /** The same, from a level you've measured yourself (e.g. only the guitar's band, so the click doesn't count). */
  feedLevel(rms: number, time: number): number | null {
    const rising = rms > this.minLevel && rms > this.prev * this.ratio && rms > this.floor * 3;
    // a slow average of quiet frames is the room's noise floor
    if (rms < this.floor * 4) this.floor = this.floor * 0.95 + rms * 0.05;
    this.prev = rms * 0.6 + this.prev * 0.4;
    if (rising && (this.last < 0 || time - this.last > this.lockout)) {
      this.last = time;
      return time;
    }
    return null;
  }
}

/* ------------------------------------------------------------------ speed ladder */

export interface Ladder {
  bpm: number;
  start: number;
  step: number;
  target: number;
  best: number;
  rungs: number;
}

export function startLadder(start: number, target: number, step = 4, best = 0): Ladder {
  return { bpm: start, start, step, target, best, rungs: 0 };
}

/** After a run: 2+ stars climbs a rung, otherwise stay and try again. */
export function climb(l: Ladder, stars: number): Ladder {
  if (stars < 2) return l;
  const best = Math.max(l.best, l.bpm);
  return { ...l, best, rungs: l.rungs + 1, bpm: Math.min(l.target, l.bpm + l.step) };
}

export const ladderDone = (l: Ladder) => l.best >= l.target;

/** Stars for a ladder: reaching the target is 3; most of the way is 2; any rung is 1. */
export function ladderStars(l: Ladder): number {
  if (l.best >= l.target) return 3;
  const share = (l.best - l.start) / Math.max(1, l.target - l.start);
  return l.rungs === 0 ? 0 : share >= 0.5 ? 2 : 1;
}

/* ------------------------------------------------------------------ improvise */

export interface SoloNote {
  midi: number;
  time: number;
}

export interface SoloScore {
  notes: number;
  inScale: number;
  /** Phrases: runs of notes separated by a rest of at least `gap` seconds. */
  phrases: number;
  endsHome: boolean;
  stars: number;
}

export function scoreSolo(notes: SoloNote[], scalePcs: number[], homePc: number, gap = 0.9): SoloScore {
  if (!notes.length) return { notes: 0, inScale: 0, phrases: 0, endsHome: false, stars: 0 };
  const scale = new Set(scalePcs.map((p) => ((p % 12) + 12) % 12));
  const inScale = notes.filter((n) => scale.has(((n.midi % 12) + 12) % 12)).length / notes.length;
  let phrases = 1;
  for (let i = 1; i < notes.length; i++) if (notes[i].time - notes[i - 1].time >= gap) phrases++;
  const endsHome = ((notes[notes.length - 1].midi % 12) + 12) % 12 === homePc;
  let stars = 0;
  if (notes.length >= 8 && inScale >= 0.7) stars = 1;
  if (notes.length >= 12 && inScale >= 0.85 && phrases >= 2) stars = 2;
  if (notes.length >= 12 && inScale >= 0.9 && phrases >= 3 && endsHome) stars = 3;
  return { notes: notes.length, inScale, phrases, endsHome, stars };
}

/* ------------------------------------------------------------------ fretboard game */

const OPEN: Record<number, number> = { 6: 40, 5: 45, 4: 50, 3: 55, 2: 59, 1: 64 };
export const NOTE_CHOICES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export interface FretQuestion {
  string: number;
  fret: number;
  pc: number;
  answer: string;
}

/** A random spot on the given strings and frets (never the same as the last). */
export function fretQuestion(strings: number[], frets: [number, number], last: FretQuestion | null, rnd: () => number = Math.random): FretQuestion {
  for (let tries = 0; tries < 20; tries++) {
    const string = strings[Math.floor(rnd() * strings.length)];
    const fret = frets[0] + Math.floor(rnd() * (frets[1] - frets[0] + 1));
    if (last && last.string === string && last.fret === fret) continue;
    const pc = (OPEN[string] + fret) % 12;
    return { string, fret, pc, answer: NOTE_CHOICES[pc] };
  }
  const pc = (OPEN[strings[0]] + frets[0]) % 12;
  return { string: strings[0], fret: frets[0], pc, answer: NOTE_CHOICES[pc] };
}

/** Same note under its other name (A# = Bb), for answers typed or tapped either way. */
export function sameNote(a: string, b: string): boolean {
  const FLAT: Record<string, string> = { Db: "C#", Eb: "D#", Gb: "F#", Ab: "G#", Bb: "A#" };
  return (FLAT[a] ?? a) === (FLAT[b] ?? b);
}
