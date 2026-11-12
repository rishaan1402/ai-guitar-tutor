/**
 * Pure helpers for microphone capture: WAV encoding, level maths and the
 * strum-decay auto-stop. Kept free of React / Web Audio so they can be tested.
 */

/** Encode mono float samples as 16-bit PCM WAV at the given sample rate. */
export function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  return new Blob([encodeWavBuffer(samples, sampleRate)], { type: "audio/wav" });
}

/** The WAV bytes behind `encodeWav` (header + PCM16 little-endian). */
export function encodeWavBuffer(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const rate = Math.round(sampleRate);
  const numSamples = samples.length;
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, rate, true); // sample rate
  view.setUint32(28, rate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeString(view, 36, "data");
  view.setUint32(40, numSamples * 2, true);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }
  return buffer;
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

export function mergeChunks(chunks: Float32Array[]): Float32Array {
  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const merged = new Float32Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return merged;
}

export interface FrameStats {
  rms: number;
  peak: number;
}

export function frameStats(samples: Float32Array): FrameStats {
  let sumSq = 0;
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const v = samples[i];
    sumSq += v * v;
    const a = v < 0 ? -v : v;
    if (a > peak) peak = a;
  }
  return { rms: samples.length ? Math.sqrt(sumSq / samples.length) : 0, peak };
}

export const DB_FLOOR = -60;

/** Linear amplitude → dBFS, floored at DB_FLOOR. */
export function toDbfs(amplitude: number): number {
  if (!(amplitude > 0)) return DB_FLOOR;
  return Math.max(DB_FLOOR, Math.min(0, 20 * Math.log10(amplitude)));
}

/** dBFS (−60..0) → meter height 0..1. */
export function dbfsToLevel(db: number): number {
  return Math.max(0, Math.min(1, (db - DB_FLOOR) / -DB_FLOOR));
}

/** Peak below this after a strum window means the mic is barely hearing us. */
export const TOO_QUIET_DBFS = -45;
/** Peak above this is (nearly) clipping. */
export const CLIP_DBFS = -1;

export type LevelHint = "too_quiet" | "clipping" | null;

export function levelHint(peakDbfs: number, elapsedSeconds: number): LevelHint {
  if (peakDbfs > CLIP_DBFS) return "clipping";
  if (elapsedSeconds >= 1.5 && peakDbfs < TOO_QUIET_DBFS) return "too_quiet";
  return null;
}

export interface AutoStopOptions {
  /** Hard cap on recording length. */
  maxSeconds?: number;
  /** Stop once RMS stays below this fraction of the recording's peak RMS… */
  decayRatio?: number;
  /** …for this long. */
  holdSeconds?: number;
  /** RMS a frame must reach to count as a strum (≈ −40 dBFS). */
  strumRms?: number;
}

/**
 * Tracks frame RMS over time and decides when a recording is "done": after
 * `maxSeconds`, or once a strum has rung out (RMS < decayRatio·peak for
 * holdSeconds). Silence alone never triggers the decay stop.
 */
export class AutoStopDetector {
  readonly maxSeconds: number;
  readonly decayRatio: number;
  readonly holdSeconds: number;
  readonly strumRms: number;
  private peakRms = 0;
  private quietSince: number | null = null;

  constructor(opts: AutoStopOptions = {}) {
    this.maxSeconds = opts.maxSeconds ?? 6;
    this.decayRatio = opts.decayRatio ?? 0.15;
    this.holdSeconds = opts.holdSeconds ?? 1.2;
    this.strumRms = opts.strumRms ?? 0.01;
  }

  /** Feed one frame; `t` is seconds since recording started. Returns true to stop. */
  update(rms: number, t: number): boolean {
    if (t >= this.maxSeconds) return true;
    if (rms > this.peakRms) this.peakRms = rms;
    if (this.peakRms < this.strumRms) return false;
    if (rms < this.peakRms * this.decayRatio) {
      if (this.quietSince === null) this.quietSince = t;
      return t - this.quietSince >= this.holdSeconds;
    }
    this.quietSince = null;
    return false;
  }
}

/** Order-insensitive equality for note lists (used to emit live notes on change only). */
export function sameNotes(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((n, i) => n === sb[i]);
}
