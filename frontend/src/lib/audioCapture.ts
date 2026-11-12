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
  /** Hard cap on recording length (seconds since the first frame). */
  maxSeconds?: number;
  /** Cap measured from the moment the detector arms instead (armed-recording mode). */
  maxAfterArmSeconds?: number;
  /** Stop once RMS stays below this fraction of the strum's peak RMS… */
  decayRatio?: number;
  /** …for this long. */
  holdSeconds?: number;
  /** RMS a frame must reach to count as loud (≈ −40 dBFS) — the ceiling of the adaptive threshold. */
  strumRms?: number;
  /**
   * Adaptive threshold: after `ignoreSeconds` the loud threshold becomes
   * clamp(floorFactor × median RMS of the frames so far, minStrumRms, strumRms),
   * so a quiet player in a quiet room (strum ≈ −45 dBFS RMS) still arms.
   * Set floorFactor to 0 to disable.
   */
  floorFactor?: number;
  minStrumRms?: number;
  /** Consecutive loud frames needed to arm (3 × 2048 samples ≈ 128 ms at 48 kHz). */
  sustainFrames?: number;
  /** Ignore loudness before this time (the key/mouse click that started the take). */
  ignoreSeconds?: number;
  /** Give up with "silent" if nothing has armed by this time. */
  noStrumSeconds?: number;
}

export type StopReason = "decay" | "max" | "silent";

/**
 * Tracks frame RMS over time and decides when a take is "done".
 *
 * A single loud frame (a key press or mouse click) no longer counts as the
 * strum: the detector only *arms* after `sustainFrames` consecutive frames at
 * or above `strumRms`, and not before `ignoreSeconds`. The peak used by the
 * decay rule is the max over that sustained run. Before arming the decay stop
 * is impossible; if nothing arms by `noStrumSeconds` it stops with "silent"
 * (the caller must not upload that take).
 */
export class AutoStopDetector {
  readonly maxSeconds: number;
  readonly maxAfterArmSeconds: number | null;
  readonly decayRatio: number;
  readonly holdSeconds: number;
  readonly strumRms: number;
  readonly sustainFrames: number;
  readonly ignoreSeconds: number;
  readonly noStrumSeconds: number;
  readonly floorFactor: number;
  readonly minStrumRms: number;
  private floorFrames: number[] = [];
  private threshold: number | null = null;
  private peakRms = 0;
  private runPeak = 0;
  private quietSince: number | null = null;
  private _loudRun = 0;
  private _armedAt: number | null = null;

  constructor(opts: AutoStopOptions = {}) {
    this.maxSeconds = opts.maxSeconds ?? 6;
    this.maxAfterArmSeconds = opts.maxAfterArmSeconds ?? null;
    this.decayRatio = opts.decayRatio ?? 0.15;
    this.holdSeconds = opts.holdSeconds ?? 1.2;
    this.strumRms = opts.strumRms ?? 0.01;
    this.sustainFrames = opts.sustainFrames ?? 3;
    this.ignoreSeconds = opts.ignoreSeconds ?? 0.3;
    this.noStrumSeconds = opts.noStrumSeconds ?? 3;
    this.floorFactor = opts.floorFactor ?? 4;
    this.minStrumRms = opts.minStrumRms ?? 0.0025;
  }

  /** The loud-frame threshold in use (strumRms until the floor is known). */
  get loudRms(): number {
    return this.threshold ?? this.strumRms;
  }

  get armed(): boolean {
    return this._armedAt !== null;
  }
  /** Time (seconds, the caller's clock) at which the sustained strum armed the detector. */
  get armedAt(): number | null {
    return this._armedAt;
  }
  /** Length of the current run of loud frames (at arm time: the run that armed it). */
  get loudRun(): number {
    return this._loudRun;
  }

  /** Feed one frame; `t` is seconds since the first frame (frame end). Returns why to stop, or null. */
  update(rms: number, t: number): StopReason | null {
    if (this._armedAt === null) {
      if (this.threshold === null) {
        if (t < this.ignoreSeconds) this.floorFrames.push(rms);
        else {
          const xs = this.floorFrames.sort((a, b) => a - b);
          const floor = xs.length ? xs[xs.length >> 1] : this.strumRms;
          this.threshold =
            this.floorFactor > 0
              ? Math.min(this.strumRms, Math.max(this.minStrumRms, this.floorFactor * floor))
              : this.strumRms;
        }
      }
      if (rms >= this.loudRms) {
        this._loudRun += 1;
        this.runPeak = Math.max(this.runPeak, rms);
      } else {
        this._loudRun = 0;
        this.runPeak = 0;
      }
      if (this._loudRun >= this.sustainFrames && t >= this.ignoreSeconds) {
        this._armedAt = t;
        this.peakRms = this.runPeak;
        this.quietSince = null;
        return null;
      }
      if (t >= this.maxSeconds) return "max";
      if (t >= this.noStrumSeconds) return "silent";
      return null;
    }

    if (t >= this.maxSeconds) return "max";
    if (this.maxAfterArmSeconds !== null && t - this._armedAt >= this.maxAfterArmSeconds) return "max";
    if (rms >= this.loudRms) this._loudRun += 1;
    else this._loudRun = 0;
    if (rms > this.peakRms) this.peakRms = rms;
    if (rms < this.peakRms * this.decayRatio) {
      if (this.quietSince === null) this.quietSince = t;
      return t - this.quietSince >= this.holdSeconds ? "decay" : null;
    }
    this.quietSince = null;
    return null;
  }
}

/** Frames needed to cover `seconds` of audio at `sampleRate` in `frameSize` blocks. */
export function prerollFrameCount(seconds: number, sampleRate: number, frameSize: number): number {
  return Math.ceil((seconds * sampleRate) / frameSize);
}

/**
 * Fixed-size ring of the most recent frames, kept while the mic is armed so a
 * take can start a little *before* the onset that triggered it.
 */
export class PrerollBuffer {
  readonly capacity: number;
  private frames: Float32Array[] = [];
  private head = 0;

  constructor(capacity: number) {
    this.capacity = Math.max(1, Math.floor(capacity));
  }

  push(frame: Float32Array): void {
    if (this.frames.length < this.capacity) {
      this.frames.push(frame);
    } else {
      this.frames[this.head] = frame;
      this.head = (this.head + 1) % this.capacity;
    }
  }

  get size(): number {
    return this.frames.length;
  }

  /** The last `n` frames (default: all held), oldest first. */
  snapshot(n: number = this.capacity): Float32Array[] {
    const ordered =
      this.frames.length < this.capacity
        ? this.frames.slice()
        : [...this.frames.slice(this.head), ...this.frames.slice(0, this.head)];
    const k = Math.max(0, Math.min(Math.floor(n), ordered.length));
    return ordered.slice(ordered.length - k);
  }

  clear(): void {
    this.frames = [];
    this.head = 0;
  }
}

/** Order-insensitive equality for note lists (used to emit live notes on change only). */
export function sameNotes(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((n, i) => n === sb[i]);
}
