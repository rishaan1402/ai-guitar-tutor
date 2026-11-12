/**
 * Per-string "is the expected pitch there?" energy for the live listening
 * stage, plus the post-take per-string verdicts. Pure functions, no Web Audio.
 *
 * Coaching only: overlapping harmonics (E2's 2nd harmonic is E3) can light a
 * neighbouring string, so energy means "the pitch this string should make is
 * present", never proof the string rang. Grading stays on the server.
 */
import type { ChordFingering } from "./api";
import { detectPeaks } from "./noteDetection";

/** Open-string MIDI notes by string number (6 = low E … 1 = high e). */
export const OPEN_MIDI: Record<number, number> = { 6: 40, 5: 45, 4: 50, 3: 55, 2: 59, 1: 64 };

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const PC: Record<string, number> = {
  C: 0, "B#": 0, "C#": 1, DB: 1, D: 2, "D#": 3, EB: 3, E: 4, FB: 4, F: 5, "E#": 5,
  "F#": 6, GB: 6, G: 7, "G#": 8, AB: 8, A: 9, "A#": 10, BB: 10, B: 11, CB: 11,
};

/** Pitch class of a note name ("Eb", "D#", "e", "F#3"), or null. */
export function pitchClass(note: string | null | undefined): number | null {
  if (!note) return null;
  const m = /^([A-Ga-g])([#b♯♭]?)/.exec(note.trim());
  if (!m) return null;
  const acc = m[2] === "♯" ? "#" : m[2] === "♭" || m[2] === "b" ? "B" : m[2];
  return PC[(m[1].toUpperCase() + acc).toUpperCase()] ?? null;
}

export interface StringTarget {
  /** Guitar string number, 6 (low E) … 1 (high e). */
  string: number;
  /** Sounding MIDI note, or null when the string is muted. */
  midi: number | null;
  muted: boolean;
  fret: number | null;
  /** Pitch-class name ("E"), or null when muted. */
  note: string | null;
}

/** Six targets, low E (string 6) first, from the teaching voicing in /fingering/{chord}. */
export function stringTargets(fingering: ChordFingering | null | undefined): StringTarget[] {
  const positions = fingering?.positions ?? [];
  return [6, 5, 4, 3, 2, 1].map((s) => {
    const p = positions.find((q) => q.string === s);
    if (!p || p.action === "mute" || p.fret === undefined || p.fret === null) {
      return { string: s, midi: null, muted: true, fret: null, note: null };
    }
    const midi = OPEN_MIDI[s] + p.fret;
    return { string: s, midi, muted: false, fret: p.fret, note: p.note ?? NOTE_NAMES[midi % 12] };
  });
}

export function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

const HARMONICS: readonly [number, number][] = [
  [1, 1],
  [2, 0.6],
  [3, 0.4],
];
const WEIGHT_SUM = HARMONICS.reduce((s, [, w]) => s + w, 0);
const DB_MIN = -160;
/** Floors are never taken below this (a fake/silent device reports −∞ dB). */
const FLOOR_MIN_DB = -110;
/** …nor above this (listening began mid-strum: don't treat the chord itself as noise). */
const FLOOR_MAX_DB = -75;
/** How fast the rolling-minimum floor may rise (dB/s). */
const FLOOR_RISE_DB_S = 3;

export interface EnergyOptions {
  /** Window for the noise-floor median at the start of listening. */
  floorSeconds?: number;
  attackSeconds?: number;
  releaseSeconds?: number;
  /** dB above the floor that maps to energy 0 … */
  onDb?: number;
  /** … and the minimum span (dB) that maps to 1 (the running peak can stretch it). */
  spanDb?: number;
  /** Extra-note peaks must clear the floor by this much. */
  extraDb?: number;
  extraFlashSeconds?: number;
  /** A string more than this many dB below the loudest one fades to 0 (12 dB ramp). */
  relDb?: number;
  /**
   * A dark string must read as present this long before it lights: while the
   * 8192-sample window slides over a fresh attack the spectrum is smeared, and
   * a neighbouring note (B2 for C3) briefly looks like this string.
   */
  confirmSeconds?: number;
}

export interface EnergyState {
  elapsed: number;
  floorSamples: number[][];
  floor: Float64Array | null;
  /** Rolling per-string minimum (linear), rising slowly; corrects a floor taken mid-strum. */
  rollingMin: Float64Array;
  /** Running peak of dB-above-floor across strings, slowly decaying. */
  peakDb: number;
  energy: Float32Array;
  extra: Float32Array;
  /** Seconds each string's raw target has stayed above the confirm level. */
  heldFor: Float32Array;
  opts: Required<EnergyOptions>;
}

export function createEnergyState(opts: EnergyOptions = {}): EnergyState {
  return {
    elapsed: 0,
    floorSamples: Array.from({ length: 6 }, () => []),
    floor: null,
    rollingMin: new Float64Array(6).fill(Infinity),
    peakDb: 0,
    energy: new Float32Array(6),
    extra: new Float32Array(6),
    heldFor: new Float32Array(6),
    opts: {
      floorSeconds: opts.floorSeconds ?? 0.3,
      attackSeconds: opts.attackSeconds ?? 0.03,
      releaseSeconds: opts.releaseSeconds ?? 0.4,
      onDb: opts.onDb ?? 6,
      spanDb: opts.spanDb ?? 24,
      extraDb: opts.extraDb ?? 24,
      extraFlashSeconds: opts.extraFlashSeconds ?? 0.18,
      relDb: opts.relDb ?? 30,
      confirmSeconds: opts.confirmSeconds ?? 0.12,
    },
  };
}

/** How far a peak must rise above its neighbourhood median to count as a note. */
const PROMINENCE_DB = 10;
const clampDb = (v: number) => (Number.isFinite(v) ? Math.max(v, DB_MIN) : DB_MIN);

/**
 * Level (dB) of a spectral peak within ±35 cents of `hz` (widened to half a bin
 * at low pitch, capped at 60 c), located by parabolic interpolation. With no
 * such peak it is the band's minimum, so the skirt of a neighbouring note a
 * semitone away (≈1 bin at 82–130 Hz) doesn't count as this string ringing.
 */
export function bandPeakDb(freqDb: Float32Array, hz: number, binHz: number): number {
  const centre = hz / binHz;
  const tol = Math.max(35, Math.min(60, 1200 * Math.log2((hz + binHz / 2) / hz)));
  const lo = Math.max(1, Math.floor(centre) - 2);
  const hi = Math.min(freqDb.length - 2, Math.ceil(centre) + 2);
  let best = -Infinity;
  let minv = Infinity;
  for (let i = lo; i <= hi; i++) {
    const b = clampDb(freqDb[i]);
    if (b < minv) minv = b;
    const a = clampDb(freqDb[i - 1]);
    const g = clampDb(freqDb[i + 1]);
    if (b < a || b < g || (a === b && g === b)) continue;
    const den = a - 2 * b + g;
    const p = den !== 0 ? Math.max(-0.5, Math.min(0.5, (0.5 * (a - g)) / den)) : 0;
    const cents = 1200 * Math.log2(((i + p) * binHz) / hz);
    if (Math.abs(cents) <= tol) best = Math.max(best, b - 0.25 * (a - g) * p);
  }
  if (!Number.isFinite(best)) return Number.isFinite(minv) ? minv : DB_MIN;
  // Tonal, not noise: the peak must stand out from its ±8-bin neighbourhood
  // (broadband noise has local maxima everywhere, none prominent).
  const nb: number[] = [];
  for (let i = Math.max(0, Math.round(centre) - 8); i <= Math.min(freqDb.length - 1, Math.round(centre) + 8); i++) {
    nb.push(clampDb(freqDb[i]));
  }
  nb.sort((x, y) => x - y);
  const ref = nb[Math.floor(nb.length * 0.25)]; // lower quartile: robust to neighbouring chord tones
  return best - ref >= PROMINENCE_DB ? best : Math.min(minv, ref);
}

/**
 * Weighted linear level of a string's f0, 2f0, 3f0. Harmonics only support a
 * fundamental that is there (each is capped at 2× the f0 level), so another
 * string's note that happens to be this string's 3rd harmonic (G4 for C3)
 * can't light it on its own.
 */
function stringLevel(freqDb: Float32Array, midi: number, binHz: number): number {
  const f0 = midiToHz(midi);
  let sum = 0;
  let fund = 0;
  for (const [h, w] of HARMONICS) {
    const f = f0 * h;
    if (f / binHz >= freqDb.length - 2) continue;
    const lin = Math.pow(10, bandPeakDb(freqDb, f, binHz) / 20);
    if (h === 1) fund = lin;
    sum += w * (h === 1 ? lin : Math.min(lin, 2 * fund));
  }
  return sum / WEIGHT_SUM;
}

function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Update `state.energy` (0..1 per string, low E first) and `state.extra`
 * (coral flash per string) from one `getFloatFrequencyData` frame.
 * `dt` is seconds since the previous frame.
 */
export function stringEnergies(
  freqDb: Float32Array,
  sampleRate: number,
  fftSize: number,
  targets: StringTarget[],
  state: EnergyState,
  dt: number,
): EnergyState {
  const o = state.opts;
  const binHz = sampleRate / fftSize;
  state.elapsed += dt;

  const levels = targets.map((t) => (t.midi === null ? 0 : stringLevel(freqDb, t.midi, binHz)));

  // Noise floor: per-string median over the first `floorSeconds`; afterwards it can
  // only drop to the rolling minimum (if listening began mid-strum the median is high).
  const minLin = Math.pow(10, FLOOR_MIN_DB / 20);
  const rise = Math.pow(10, (FLOOR_RISE_DB_S * dt) / 20);
  levels.forEach((l, i) => {
    const m = state.rollingMin[i];
    state.rollingMin[i] = Math.max(minLin, Math.min(Number.isFinite(m) ? m * rise : Infinity, l));
  });
  if (!state.floor) {
    levels.forEach((l, i) => targets[i].midi !== null && state.floorSamples[i].push(Math.max(l, minLin)));
    if (state.elapsed >= o.floorSeconds) {
      state.floor = Float64Array.from(state.floorSamples.map((xs) => Math.max(median(xs), minLin)));
    }
  }
  const maxLin = Math.pow(10, FLOOR_MAX_DB / 20);
  const floor = (
    state.floor
      ? state.floor.map((f, i) => Math.min(f, state.rollingMin[i]))
      : Float64Array.from(state.floorSamples.map((xs) => Math.max(median(xs), minLin)))
  ).map((f) => Math.min(f, maxLin));

  const above = levels.map((l, i) => (targets[i].midi === null ? 0 : 20 * Math.log10(Math.max(l, 1e-12) / floor[i])));
  const frameMax = Math.max(0, ...above);
  // Running peak: rises instantly, falls ~6 dB/s, so one loud strum doesn't dim the next forever.
  state.peakDb = Math.max(frameMax, state.peakDb - 6 * dt);
  // Scale to the loudest string, but strings within ~36 dB of the floor never need more
  // than that to read as fully "heard" (an attack transient shouldn't dim the whole chord).
  const span = Math.min(o.spanDb * 1.5, Math.max(o.spanDb, state.peakDb - o.onDb));

  const aA = 1 - Math.exp(-dt / o.attackSeconds);
  const aR = 1 - Math.exp(-dt / o.releaseSeconds);
  for (let i = 0; i < 6; i++) {
    // Above the floor, and not far below the loudest string (leakage and partials are 25+ dB down).
    const floorPart = Math.max(0, Math.min(1, (above[i] - o.onDb) / span));
    const relPart = Math.max(0, Math.min(1, (above[i] - (state.peakDb - o.relDb)) / 12));
    let target = targets[i]?.midi === null ? 0 : floorPart * relPart;
    state.heldFor[i] = target > 0.3 ? state.heldFor[i] + dt : 0;
    if (state.energy[i] < 0.3 && state.heldFor[i] < o.confirmSeconds) target = 0;
    const e = state.energy[i];
    state.energy[i] = e + (target - e) * (target > e ? aA : aR);
  }

  // Extra notes: strong peaks more than 50 cents from every chord tone (any octave).
  const decay = Math.exp(-dt / o.extraFlashSeconds);
  for (let i = 0; i < 6; i++) state.extra[i] *= decay;
  if (state.floor) {
    const chordMidis = targets.filter((t) => t.midi !== null).map((t) => t.midi as number);
    if (chordMidis.length) {
      const floorDb = 20 * Math.log10(median(Array.from(floor)));
      const peaks = detectPeaks(freqDb, sampleRate, fftSize, Math.max(-75, floorDb + o.extraDb), 8);
      for (const p of peaks) {
        if (p.freq < 75 || p.freq > 1100) continue;
        const m = 69 + 12 * Math.log2(p.freq / 440);
        const nearChord = chordMidis.some((c) => {
          const diff = m - c;
          return Math.abs(diff - 12 * Math.round(diff / 12)) <= 0.5; // within 50 c of some octave of c
        });
        if (nearChord) continue;
        // Upper partials of the strings we expect (e.g. the 7th harmonic) aren't extra notes.
        const isPartial = chordMidis.some((c) => {
          const h = p.freq / midiToHz(c);
          const k = Math.round(h);
          return k >= 2 && k <= 10 && Math.abs(1200 * Math.log2(h / k)) <= 30;
        });
        if (isPartial) continue;
        // Nearest string by pitch (its sounding note, or the open note when muted).
        let best = 0;
        let bestD = Infinity;
        targets.forEach((t, i) => {
          const ref = t.midi ?? OPEN_MIDI[t.string];
          const d = Math.abs(m - ref);
          if (d < bestD) {
            bestD = d;
            best = i;
          }
        });
        state.extra[best] = 1;
      }
    }
  }
  return state;
}

export type StringVerdict = "ok" | "missing" | "unclear" | "extra" | "muted";

interface EvalLike {
  missing_notes?: string[];
  unclear_notes?: string[];
  extra_notes?: string[];
}

/**
 * Per-string review state from the server's evaluation (low E first):
 * a string whose note is in missing_notes is "missing", in unclear_notes
 * "unclear", otherwise "ok". A muted string whose open note was heard as an
 * extra is "extra" (it probably rang when it shouldn't have).
 */
export function stringVerdicts(evaluation: EvalLike | null | undefined, targets: StringTarget[]): StringVerdict[] {
  const set = (xs?: string[]) => new Set((xs ?? []).map(pitchClass).filter((x): x is number => x !== null));
  const missing = set(evaluation?.missing_notes);
  const unclear = set(evaluation?.unclear_notes);
  const extra = set(evaluation?.extra_notes);
  return targets.map((t) => {
    if (t.muted || t.midi === null) return extra.has(OPEN_MIDI[t.string] % 12) ? "extra" : "muted";
    const pc = t.midi % 12;
    if (missing.has(pc)) return "missing";
    if (unclear.has(pc)) return "unclear";
    return "ok";
  });
}
