/**
 * Lesson steps. A session is a short list of steps; each one teaches or tests
 * one thing, and the scored ones (Grooves, quizzes, note-finding, ear and
 * rhythm drills) earn the session's stars.
 */
import type { Groove } from "../groove/groove";

const OPEN_MIDI: Record<number, number> = { 6: 40, 5: 45, 4: 50, 3: 55, 2: 59, 1: 64 };
const PC_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const PC_OF: Record<string, number> = {
  C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11,
};

/* ------------------------------------------------------------------ figures */

/** A dot on a fretboard diagram. `role`: "root" is filled amber, "ghost" is hollow. */
export interface Dot {
  string: number;
  fret: number;
  label?: string;
  role?: "root" | "note" | "ghost";
}

export type Figure =
  | { kind: "chord"; chord: string }
  | { kind: "fretboard"; dots: Dot[]; from?: number; to?: number; caption?: string }
  | { kind: "tab"; tab: string; caption?: string }
  /** A listen button: notes (MIDI, played in turn) or a chord strum. */
  | { kind: "sound"; label: string; notes?: number[]; chord?: string; gap?: number; together?: boolean };

/* ------------------------------------------------------------------ steps */

export interface Question {
  q: string;
  options: string[];
  /** Index of the right option. */
  answer: number;
  why: string;
}

/** A note to play: an exact MIDI note, or a pitch class in any octave. */
export interface Target {
  midi?: number;
  pc?: number;
  label: string;
}

export type EarMode = "interval" | "quality" | "higher";

export type Step =
  | { kind: "read"; title: string; body: string; figures?: Figure[] }
  | { kind: "learn"; chord: string; points: string[] }
  | { kind: "check"; chord: string }
  | { kind: "groove"; groove: Groove; label?: string; mode?: "wait" | "follow" | "play" }
  | { kind: "quiz"; title: string; questions: Question[] }
  | { kind: "play"; title: string; prompt: string; targets: Target[]; figure?: Figure }
  | { kind: "ear"; title: string; mode: EarMode; options: string[]; rounds: number }
  | { kind: "rhythm"; title: string; prompt: string; pattern: string; bpm: number; bars: number };

export interface PathSession {
  id: string;
  title: string;
  /** One line under the title. */
  blurb: string;
  steps: Step[];
}

export interface PathLevel {
  id: string;
  title: string;
  blurb: string;
  sessions: PathSession[];
}

export interface PathTrack {
  id: string;
  title: string;
  blurb: string;
  levels: PathLevel[];
}

export const SCORED: Step["kind"][] = ["groove", "quiz", "play", "ear", "rhythm"];

/** Stars for a share of right answers / clean hits. */
export function starsFor(share: number): number {
  return share >= 0.9 ? 3 : share >= 0.7 ? 2 : share >= 0.4 ? 1 : 0;
}

/** Session stars: the average of its scored steps; a skipped check caps it at 2. */
export function sessionStars(scores: number[], checkSkipped: boolean): number {
  const base = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 3;
  return Math.max(1, Math.min(checkSkipped ? 2 : 3, base));
}

/** New chords a session teaches (its "learn" steps). */
export function chordsIn(s: PathSession): string[] {
  return s.steps.flatMap((st) => (st.kind === "learn" ? [st.chord] : []));
}

/* ------------------------------------------------------------------ builders (used by the tracks) */

export const S = (id: string, title: string, blurb: string, ...steps: Step[]): PathSession => ({ id, title, blurb, steps });
export const read = (title: string, body: string, ...figures: Figure[]): Step => ({ kind: "read", title, body, figures });
/** Learn a chord, then play it for the app. */
export const chord = (c: string, ...points: string[]): Step[] => [{ kind: "learn", chord: c, points }, { kind: "check", chord: c }];
export const groove = (g: Groove, mode?: "wait" | "follow" | "play", label?: string): Step => ({ kind: "groove", groove: g, mode, label });
export const quiz = (title: string, ...questions: Question[]): Step => ({ kind: "quiz", title, questions });
export const q = (question: string, options: string[], answer: number, why: string): Question => ({ q: question, options, answer, why });
export const ear = (title: string, mode: EarMode, options: string[], rounds = 8): Step => ({ kind: "ear", title, mode, options, rounds });
export const rhythm = (title: string, prompt: string, pattern: string, bpm: number, bars = 2): Step => ({ kind: "rhythm", title, prompt, pattern, bpm, bars });
export const play = (title: string, prompt: string, targets: Target[], figure?: Figure): Step => ({ kind: "play", title, prompt, targets, figure });

export const g = (id: string, title: string, bars: string[][], o: Partial<Groove> = {}): Groove => ({
  id, title, style: "folk", bpm: 66, bars, strum: "D...D...", loops: 2, ...o,
});
export const lead = (id: string, title: string, bars: string[][], o: Partial<Groove> = {}): Groove => ({
  kind: "lead", id, title, style: "ballad", bpm: 60, bars, strum: "........", loops: 2, ...o,
});

/**
 * Exact notes from tab tokens: "6:3" (low E string, 3rd fret), "3:7b2" (G string,
 * 7th fret bent up 2 semitones), "1:12h" (natural harmonic at the 12th: an octave up).
 */
export function notes(spec: string): Target[] {
  return spec.trim().split(/\s+/).map((tok) => {
    const m = /^([1-6]):(\d{1,2})(?:b([12]))?(h)?$/.exec(tok);
    if (!m) throw new Error(`bad note ${tok}`);
    const string = Number(m[1]), fret = Number(m[2]), bend = Number(m[3] ?? 0);
    const harmonic = !!m[4];
    const midi = OPEN_MIDI[string] + fret + bend + (harmonic ? (fret === 7 ? 12 : fret === 5 ? 19 : 0) : 0);
    const where = `${["", "high e", "B", "G", "D", "A", "low E"][string]} string, fret ${fret}`;
    const label = bend ? `${where}, bend up ${bend === 2 ? "a whole" : "a half"} step` : harmonic ? `${where} harmonic` : where;
    return { midi, label };
  });
}

/** Pitch classes in any octave: "C E G". */
export function pcs(spec: string): Target[] {
  return spec.trim().split(/\s+/).map((n) => {
    const pc = PC_OF[n];
    if (pc === undefined) throw new Error(`bad note name ${n}`);
    return { pc, label: `any ${n}` };
  });
}

/** Fretboard dots from tokens like "5:3R 5:5 4:2" (R = root). */
export function dots(spec: string): Dot[] {
  return spec.trim().split(/\s+/).map((tok) => {
    const m = /^([1-6]):(\d{1,2})(R|o)?(?:=(\S+))?$/.exec(tok);
    if (!m) throw new Error(`bad dot ${tok}`);
    return { string: Number(m[1]), fret: Number(m[2]), role: m[3] === "R" ? "root" : m[3] === "o" ? "ghost" : "note", label: m[4] };
  });
}

export const fret = (spec: string, caption?: string, from?: number, to?: number): Figure => ({ kind: "fretboard", dots: dots(spec), caption, from, to });
export const tab = (t: string, caption?: string): Figure => ({ kind: "tab", tab: t.replace(/^\n/, ""), caption });
export const hear = (label: string, spec: string, gap = 0.45): Figure => ({ kind: "sound", label, notes: notes(spec).map((n) => n.midi!), gap });
export const hearChord = (label: string, c: string): Figure => ({ kind: "sound", label, chord: c });
export const fig = (c: string): Figure => ({ kind: "chord", chord: c });

export function targetMatches(t: Target, midi: number): boolean {
  return t.midi !== undefined ? t.midi === midi : t.pc === ((midi % 12) + 12) % 12;
}

export const pcName = (pc: number) => PC_NAMES[((pc % 12) + 12) % 12];
export const openMidi = (string: number) => OPEN_MIDI[string];
