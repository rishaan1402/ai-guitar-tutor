/**
 * Guitar tuner maths (pure, no Web Audio): nearest open string, cents, and
 * the "held in tune" state machine fed by pitch readings (pitchy MPM).
 */

export interface OpenString {
  /** 6 = low E … 1 = high e */
  string: number;
  name: string;
  hz: number;
}

/** Standard tuning, low E first. */
export const OPEN_STRINGS: readonly OpenString[] = [
  { string: 6, name: "E", hz: 82.4069 },
  { string: 5, name: "A", hz: 110.0 },
  { string: 4, name: "D", hz: 146.8324 },
  { string: 3, name: "G", hz: 195.9977 },
  { string: 2, name: "B", hz: 246.9417 },
  { string: 1, name: "e", hz: 329.6276 },
];

const hzOf = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
/** Strings low to high from MIDI notes; the top string is lower-case when it's E like standard. */
function strings(midis: number[]): OpenString[] {
  return midis.map((m, i) => {
    const name = NOTE_NAMES[m % 12];
    return { string: 6 - i, name: i === 5 && name === "E" ? "e" : name, hz: hzOf(m) };
  });
}

export interface Tuning {
  id: string;
  label: string;
  strings: readonly OpenString[];
}

export const TUNINGS: readonly Tuning[] = [
  { id: "standard", label: "Standard (E A D G B E)", strings: OPEN_STRINGS },
  { id: "drop-d", label: "Drop D (D A D G B E)", strings: strings([38, 45, 50, 55, 59, 64]) },
  { id: "half-down", label: "Half step down (E♭ A♭ D♭ G♭ B♭ E♭)", strings: strings([39, 44, 49, 54, 58, 63]) },
  { id: "dadgad", label: "DADGAD", strings: strings([38, 45, 50, 55, 57, 62]) },
  { id: "open-g", label: "Open G (D G D G B D)", strings: strings([38, 43, 50, 55, 59, 62]) },
  { id: "open-d", label: "Open D (D A D F# A D)", strings: strings([38, 45, 50, 54, 57, 62]) },
];

/** Note name with octave for any frequency, e.g. 110 -> "A2". */
export function noteOf(hz: number): string {
  const m = Math.round(69 + 12 * Math.log2(hz / 440));
  return NOTE_NAMES[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);
}

/** Accept a reading only this clear (MPM clarity 0..1)… */
export const MIN_CLARITY = 0.9;
/** …and this loud. */
export const MIN_RMS_DBFS = -50;
/** A string counts as only if within this window of it. */
export const MAX_CENTS = 300;
/** In tune within ±5 c… */
export const IN_TUNE_CENTS = 5;
/** …held this long (ms). */
export const HOLD_MS = 500;
/** Median over the last N accepted readings. */
export const MEDIAN_N = 5;

export function cents(hz: number, refHz: number): number {
  return 1200 * Math.log2(hz / refHz);
}

/** The open string nearest to `hz` (in cents), or null when none is within ±300 c. */
export function nearestString(hz: number, set: readonly OpenString[] = OPEN_STRINGS): { index: number; cents: number } | null {
  if (!(hz > 0) || !Number.isFinite(hz)) return null;
  let best = -1;
  let bestC = Infinity;
  set.forEach((s, i) => {
    const c = cents(hz, s.hz);
    if (Math.abs(c) < Math.abs(bestC)) {
      bestC = c;
      best = i;
    }
  });
  return best >= 0 && Math.abs(bestC) <= MAX_CENTS ? { index: best, cents: bestC } : null;
}

export function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** "12 cents sharp" / "8 cents flat" / "in tune" — the needle's aria-valuetext. */
export function centsText(c: number): string {
  const n = Math.round(Math.abs(c));
  if (n <= IN_TUNE_CENTS) return n === 0 ? "in tune" : `in tune (${n} cents ${c > 0 ? "sharp" : "flat"})`;
  return `${n} cents ${c > 0 ? "sharp" : "flat"}`;
}

export interface Reading {
  hz: number;
  clarity: number;
  rmsDbfs: number;
  /** ms */
  t: number;
}

export interface TunerState {
  /** Index into OPEN_STRINGS of the string being tuned, or null. */
  index: number | null;
  /** Median cents of the recent readings for that string. */
  cents: number | null;
  recent: number[];
  inTuneSince: number | null;
  /** Strings that have been held in tune (indices into OPEN_STRINGS). */
  tuned: number[];
  /**
   * When set, only this string is listened for (the learner picked a chip,
   * or the flow auto-selected the next one); readings for others are ignored.
   */
  target: number | null;
  /** The tuning's strings, low to high. */
  strings: readonly OpenString[];
  /** When the current string went clearly out of tune (to un-tick a tuned string that drifted). */
  outSince: number | null;
  /** Guided mode moves on to the next string after each one; free mode never moves on its own. */
  advance: boolean;
}

/** A tuned string that drifts this far for this long loses its tick. */
export const RETUNE_CENTS = 15;
export const RETUNE_MS = 700;

export function initialTuner(target: number | null = 0, set: readonly OpenString[] = OPEN_STRINGS, advance = true): TunerState {
  return { index: target, cents: null, recent: [], inTuneSince: null, tuned: [], target, strings: set, outSince: null, advance };
}

/** Next string not yet tuned, low E first (or null when all six are). */
export function nextUntuned(tuned: number[], from = 0, count = OPEN_STRINGS.length): number | null {
  for (let k = 0; k < count; k++) {
    const i = (from + k) % count;
    if (!tuned.includes(i)) return i;
  }
  return null;
}

/**
 * Feed one pitch reading. Returns the new state and whether a string just
 * became "in tune" (|median| ≤ 5 c held for 500 ms). After that the target
 * auto-advances to the next untuned string.
 */
export function pushReading(state: TunerState, r: Reading): { state: TunerState; justTuned: number | null } {
  if (r.clarity < MIN_CLARITY || r.rmsDbfs <= MIN_RMS_DBFS) {
    // silence / noise: forget the hold, keep the needle where it was
    return { state: { ...state, inTuneSince: null }, justTuned: null };
  }
  let index: number;
  let c: number;
  if (state.target !== null) {
    c = cents(r.hz, state.strings[state.target].hz);
    if (Math.abs(c) > MAX_CENTS) return { state: { ...state, inTuneSince: null }, justTuned: null };
    index = state.target;
  } else {
    const n = nearestString(r.hz, state.strings);
    if (!n) return { state: { ...state, inTuneSince: null }, justTuned: null };
    index = n.index;
    c = n.cents;
  }
  const recent = index === state.index ? [...state.recent, c].slice(-MEDIAN_N) : [c];
  const med = median(recent);
  const inTune = Math.abs(med) <= IN_TUNE_CENTS;
  const since = inTune ? (state.index === index && state.inTuneSince !== null ? state.inTuneSince : r.t) : null;
  // a tuned string that has clearly drifted loses its tick, so you can come back to it
  const out = recent.length >= 3 && Math.abs(med) > RETUNE_CENTS;
  const outSince = out ? (state.index === index && state.outSince !== null ? state.outSince : r.t) : null;
  let next: TunerState = { ...state, index, cents: med, recent, inTuneSince: since, outSince };
  if (outSince !== null && r.t - outSince >= RETUNE_MS && state.tuned.includes(index)) {
    next = { ...next, tuned: state.tuned.filter((i) => i !== index) };
  }
  let justTuned: number | null = null;
  if (since !== null && r.t - since >= HOLD_MS && !next.tuned.includes(index)) {
    const tuned = [...next.tuned, index];
    justTuned = index;
    const target = state.target === null || !state.advance ? state.target : nextUntuned(tuned, index + 1, state.strings.length);
    const moved = target !== null && target !== index;
    next = { ...next, tuned, target, index: moved ? target : index, recent: moved ? [] : recent, inTuneSince: moved ? null : since, cents: moved ? null : med };
  }
  return { state: next, justTuned };
}

/** Pick a string by hand (chip tap). */
export function selectString(state: TunerState, index: number | null): TunerState {
  return { ...state, target: index, index, recent: [], cents: null, inTuneSince: null };
}

/** RMS of a frame in dBFS (floored at −100). */
export function rmsDbfs(buf: Float32Array): number {
  let s = 0;
  for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
  const rms = Math.sqrt(s / Math.max(1, buf.length));
  return rms > 0 ? Math.max(-100, 20 * Math.log10(rms)) : -100;
}

// ── Level check (onboarding step 2) ─────────────────────────────────────────

/** Peak needed to pass the level check (the meter's green band). */
export const LEVEL_PASS_DBFS = -30;
export const NOISY_FLOOR_DBFS = -45;
export const CLIP_DBFS = -1;

export interface LevelState {
  startedAt: number | null;
  floorFrames: number[];
  floorDbfs: number | null;
  peakDbfs: number;
  clipFrames: number;
  passed: boolean;
}

export function initialLevel(): LevelState {
  return { startedAt: null, floorFrames: [], floorDbfs: null, peakDbfs: -100, clipFrames: 0, passed: false };
}

/** One frame's RMS and peak (dBFS) at time `t` (ms). The floor is the median RMS of the first 500 ms. */
export function pushLevel(s: LevelState, rmsDb: number, peakDb: number, t: number): LevelState {
  const startedAt = s.startedAt ?? t;
  let { floorFrames, floorDbfs } = s;
  if (floorDbfs === null) {
    if (t - startedAt < 500) floorFrames = [...floorFrames, rmsDb];
    else floorDbfs = floorFrames.length ? median(floorFrames) : rmsDb;
  }
  const peak = Math.max(s.peakDbfs, peakDb);
  return {
    startedAt,
    floorFrames,
    floorDbfs,
    peakDbfs: peak,
    clipFrames: s.clipFrames + (peakDb >= CLIP_DBFS ? 1 : 0),
    passed: s.passed || (floorDbfs !== null && peak >= LEVEL_PASS_DBFS),
  };
}

export type LevelHintKind = "noisy" | "clipping" | null;

export function levelHintFor(s: LevelState): LevelHintKind {
  if (s.clipFrames > 3) return "clipping";
  if (s.floorDbfs !== null && s.floorDbfs > NOISY_FLOOR_DBFS) return "noisy";
  return null;
}

/** Switch tuning: everything is re-checked against the new notes. */
export function setTuning(state: TunerState, set: readonly OpenString[]): TunerState {
  return { ...state, strings: set, tuned: [], recent: [], cents: null, inTuneSince: null, outSince: null, index: state.target };
}
