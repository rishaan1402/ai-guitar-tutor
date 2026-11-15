/**
 * Live chord detection for play-along. It doesn't try to name any chord in
 * the world: it decides which of the few chords in the current Groove (or
 * song) you're playing, which is far more reliable on a phone mic.
 *
 * Pipeline per frame: dB spectrum -> spectral peaks -> 12-bin chroma ->
 * cosine match against templates of the candidate chords; strum onsets come
 * from jumps in broadband energy. Everything here is pure and testable.
 */
import { chordNotes } from "./theory";

/** 12-bin pitch-class profile from an AnalyserNode-style dB spectrum. */
export function chromaFromSpectrum(db: Float32Array, sampleRate: number, fftSize: number, minHz = 75, maxHz = 2000): Float32Array {
  const chroma = new Float32Array(12);
  const binHz = sampleRate / fftSize;
  const lo = Math.max(2, Math.floor(minHz / binHz));
  const hi = Math.min(db.length - 2, Math.ceil(maxHz / binHz));
  let top = -Infinity;
  for (let i = lo; i <= hi; i++) if (db[i] > top) top = db[i];
  const floor = top - 45; // ignore anything 45 dB under the loudest peak
  for (let i = lo; i <= hi; i++) {
    const v = db[i];
    if (v < floor || v < db[i - 1] || v < db[i + 1] || v < db[i - 2] || v < db[i + 2]) continue;
    // parabolic interpolation for a sharper frequency estimate
    const a = db[i - 1], b = v, c = db[i + 1];
    const p = 0.5 * (a - c) / (a - 2 * b + c || 1e-9);
    const hz = (i + p) * binHz;
    const midi = 69 + 12 * Math.log2(hz / 440);
    const nearest = Math.round(midi);
    const off = Math.abs(midi - nearest); // 0..0.5 semitones
    if (off > 0.35) continue;
    const mag = Math.pow(10, (v - top) / 20); // linear, relative to the loudest peak
    // low notes carry the chord's identity; very high partials are mostly harmonics
    const w = hz < 500 ? 1 : hz < 1000 ? 0.7 : 0.45;
    chroma[((nearest % 12) + 12) % 12] += Math.sqrt(mag) * w * Math.cos(off * Math.PI);
  }
  return chroma;
}

export interface Template {
  symbol: string;
  vec: Float32Array;
  /** Pitch classes of the chord tones. */
  pcs: number[];
}

/** Chord tones plus the harmonics a guitar adds (3rd harmonic = a fifth up). */
export function chordTemplate(symbol: string): Template | null {
  const n = chordNotes(symbol);
  if (!n) return null;
  const v = new Float32Array(12);
  n.pcs.forEach((pc, i) => {
    v[pc] += i === 0 ? 1.0 : 0.85;
    v[(pc + 7) % 12] += 0.22;
    v[(pc + 4) % 12] += 0.07;
  });
  v[n.root] += 0.15; // the bass note usually rings loudest
  return { symbol, vec: normalise(v), pcs: n.pcs };
}

function normalise(v: Float32Array): Float32Array {
  let s = 0;
  for (let i = 0; i < v.length; i++) s += v[i] * v[i];
  const k = s > 0 ? 1 / Math.sqrt(s) : 0;
  return v.map((x) => x * k);
}

export function cosine(a: Float32Array, b: Float32Array): number {
  let d = 0, na = 0, nb = 0;
  for (let i = 0; i < 12; i++) {
    d += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? d / Math.sqrt(na * nb) : 0;
}

export interface Match {
  symbol: string;
  score: number;
}

/**
 * How well a chroma fits a chord: shape similarity, plus credit when every
 * chord tone is clearly present (so a 7th's extra note counts) and a penalty
 * for strong notes outside the chord (so a triad loses to its 7th when the
 * 7th is really there).
 */
export function fitChord(chroma: Float32Array, t: Template): number {
  let max = 0, total = 0;
  for (let i = 0; i < 12; i++) {
    max = Math.max(max, chroma[i]);
    total += chroma[i];
  }
  if (max <= 0) return 0;
  const tones = new Set(t.pcs);
  // notes a guitar adds as harmonics of chord tones aren't counted as "outside"
  const harmonic = new Set(t.pcs.map((pc) => (pc + 7) % 12));
  // weights tuned on all 84 reference recordings (every practical chord set right)
  let coverage = 0;
  for (const pc of t.pcs) coverage += Math.min(1, chroma[pc] / (0.12 * max));
  coverage /= t.pcs.length;
  let outside = 0;
  for (let i = 0; i < 12; i++) if (!tones.has(i)) outside += harmonic.has(i) ? chroma[i] * 0.35 : chroma[i];
  return cosine(chroma, t.vec) + 0.5 * coverage - 1.2 * (outside / total);
}

/** `expected`: the chord the music says comes next gets a small head start in close calls. */
export function rankChords(chroma: Float32Array, templates: Template[], expected?: string | null): Match[] {
  return templates
    .map((t) => ({ symbol: t.symbol, score: fitChord(chroma, t) + (t.symbol === expected ? EXPECTED_BONUS : 0) }))
    .sort((x, y) => y.score - x.score);
}

export const EXPECTED_BONUS = 0.08;

/**
 * Close enough to count as the expected chord: the same chord or one of its own
 * 7th versions (E for Emaj7, Am for Am7). One strum can hide a quiet 7th, and a
 * correct chord must never stall the music. Different chords never match.
 */
export function matchesExpected(heard: string, expected: string): boolean {
  if (heard === expected) return true;
  const base = (s: string) => s.replace(/(maj7|m7b5|m7|7)$/, (q) => (q.startsWith("m7") ? "m" : ""));
  return base(heard) === base(expected);
}

/** Mean power of a dB spectrum in a band, in dB (a loudness proxy for onsets and silence). */
export function bandLevelDb(db: Float32Array, sampleRate: number, fftSize: number, minHz = 70, maxHz = 4000): number {
  const binHz = sampleRate / fftSize;
  const lo = Math.max(1, Math.floor(minHz / binHz));
  const hi = Math.min(db.length - 1, Math.ceil(maxHz / binHz));
  let sum = 0;
  for (let i = lo; i <= hi; i++) sum += Math.pow(10, db[i] / 10);
  return 10 * Math.log10(sum / (hi - lo + 1) + 1e-20);
}

export interface Heard {
  symbol: string;
  score: number;
  /** Lead over the second-best candidate. */
  margin: number;
  /** Seconds (caller's clock) when this chord was first confirmed. */
  time: number;
  /** Was there a fresh strum just before it? */
  strummed: boolean;
}

export interface TrackerOptions {
  /** Minimum cosine score to accept a chord. */
  minScore?: number;
  /** Minimum lead over the runner-up. */
  minMargin?: number;
  /** Consecutive agreeing frames needed. */
  stableFrames?: number;
  /** Level (dB) under which the input counts as silence. */
  silenceDb?: number;
  /** Level jump (dB) between frames that counts as a strum. */
  onsetDb?: number;
}

/**
 * Feed it one spectrum per frame; it reports a chord when the same candidate
 * wins for a few frames running with a clear lead. A new strum resets the
 * running chroma so a chord change is picked up quickly.
 */
export class ChordTracker {
  private templates: Template[];
  private opts: Required<TrackerOptions>;
  private acc = new Float32Array(12);
  private lastLevel = -200;
  private candidate: string | null = null;
  private count = 0;
  private sinceOnset = Infinity;
  current: Heard | null = null;
  level = -200;

  constructor(symbols: string[], opts: TrackerOptions = {}) {
    this.templates = Array.from(new Set(symbols))
      .map(chordTemplate)
      .filter((t): t is Template => !!t);
    this.opts = { minScore: 0.9, minMargin: 0.03, stableFrames: 3, silenceDb: -78, onsetDb: 5, ...opts };
  }

  /** Returns a Heard when the confirmed chord changes, else null. */
  feed(db: Float32Array, sampleRate: number, fftSize: number, time: number, expected?: string | null): Heard | null {
    const level = bandLevelDb(db, sampleRate, fftSize);
    this.level = level;
    const onset = level - this.lastLevel > this.opts.onsetDb && level > this.opts.silenceDb + 6;
    this.lastLevel = level;
    if (level < this.opts.silenceDb) {
      this.candidate = null;
      this.count = 0;
      return null;
    }
    const chroma = chromaFromSpectrum(db, sampleRate, fftSize);
    if (onset) {
      this.acc = chroma.slice();
      this.sinceOnset = 0;
      this.count = 0;
    } else {
      // gentle averaging between strums steadies the estimate
      for (let i = 0; i < 12; i++) this.acc[i] = this.acc[i] * 0.6 + chroma[i] * 0.4;
      this.sinceOnset++;
    }
    const ranked = rankChords(this.acc, this.templates, expected);
    if (!ranked.length) return null;
    const best = ranked[0];
    const margin = ranked.length > 1 ? best.score - ranked[1].score : best.score;
    if (best.score < this.opts.minScore || margin < this.opts.minMargin) {
      this.count = 0;
      return null;
    }
    if (best.symbol === this.candidate) this.count++;
    else {
      this.candidate = best.symbol;
      this.count = 1;
    }
    if (this.count >= this.opts.stableFrames && this.current?.symbol !== best.symbol) {
      this.current = { symbol: best.symbol, score: best.score, margin, time, strummed: this.sinceOnset < 12 };
      return this.current;
    }
    return null;
  }

  reset(): void {
    this.current = null;
    this.candidate = null;
    this.count = 0;
  }
}
