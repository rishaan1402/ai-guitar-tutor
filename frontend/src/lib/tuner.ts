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
export function nearestString(hz: number): { index: number; cents: number } | null {
  if (!(hz > 0) || !Number.isFinite(hz)) return null;
  let best = -1;
  let bestC = Infinity;
  OPEN_STRINGS.forEach((s, i) => {
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
}

export function initialTuner(target: number | null = 0): TunerState {
  return { index: target, cents: null, recent: [], inTuneSince: null, tuned: [], target };
}

/** Next string not yet tuned, low E first (or null when all six are). */
export function nextUntuned(tuned: number[], from = 0): number | null {
  for (let k = 0; k < OPEN_STRINGS.length; k++) {
    const i = (from + k) % OPEN_STRINGS.length;
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
    c = cents(r.hz, OPEN_STRINGS[state.target].hz);
    if (Math.abs(c) > MAX_CENTS) return { state: { ...state, inTuneSince: null }, justTuned: null };
    index = state.target;
  } else {
    const n = nearestString(r.hz);
    if (!n) return { state: { ...state, inTuneSince: null }, justTuned: null };
    index = n.index;
    c = n.cents;
  }
  const recent = index === state.index ? [...state.recent, c].slice(-MEDIAN_N) : [c];
  const med = median(recent);
  const inTune = Math.abs(med) <= IN_TUNE_CENTS;
  const since = inTune ? (state.index === index && state.inTuneSince !== null ? state.inTuneSince : r.t) : null;
  let next: TunerState = { ...state, index, cents: med, recent, inTuneSince: since };
  let justTuned: number | null = null;
  if (since !== null && r.t - since >= HOLD_MS && !state.tuned.includes(index)) {
    const tuned = [...state.tuned, index];
    justTuned = index;
    const target = state.target === null ? null : nextUntuned(tuned, index + 1);
    next = { ...next, tuned, target, index: target ?? index, recent: target === null ? recent : [], inTuneSince: null, cents: target === null ? med : null };
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
