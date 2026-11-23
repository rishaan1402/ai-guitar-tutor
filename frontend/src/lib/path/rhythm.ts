/**
 * Rhythm drills: a pattern of hits on a grid ("x" hit, "." rest). Eight
 * characters per bar is eighth notes; sixteen is sixteenths; twelve is triplet
 * eighths. Taps are scored against the nearest expected hit.
 */

export interface RhythmPlan {
  /** Seconds from the downbeat of bar 1 for each expected hit. */
  hits: number[];
  /** Length of everything in seconds (without the count-in). */
  length: number;
  slotsPerBar: number;
  slotSec: number;
}

export function planRhythm(pattern: string, bpm: number, bars: number): RhythmPlan {
  const p = pattern.replace(/\s+/g, "");
  const slotsPerBar = p.length;
  const beatSec = 60 / bpm;
  const slotSec = (beatSec * 4) / slotsPerBar;
  const hits: number[] = [];
  for (let b = 0; b < bars; b++) {
    for (let i = 0; i < slotsPerBar; i++) if (p[i] === "x" || p[i] === "X") hits.push((b * slotsPerBar + i) * slotSec);
  }
  return { hits, length: bars * beatSec * 4, slotsPerBar, slotSec };
}

export interface RhythmScore {
  /** Per expected hit: timing error in ms (negative = early), or null if missed. */
  errors: (number | null)[];
  extra: number;
  share: number;
}

/** Match taps (seconds from the downbeat) to hits within `windowMs`. */
export function scoreTaps(hits: number[], taps: number[], windowMs = 110): RhythmScore {
  const used = new Set<number>();
  const errors = hits.map((h) => {
    let best = -1, bestErr = Infinity;
    taps.forEach((t, k) => {
      if (used.has(k)) return;
      const e = Math.abs(t - h) * 1000;
      if (e < bestErr) (bestErr = e), (best = k);
    });
    if (best < 0 || bestErr > windowMs) return null;
    used.add(best);
    return Math.round((taps[best] - h) * 1000);
  });
  const extra = taps.length - used.size;
  const hitCount = errors.filter((e) => e !== null).length;
  const share = hits.length ? Math.max(0, (hitCount - extra * 0.5) / hits.length) : 0;
  return { errors, extra, share };
}

/**
 * A strum written the usual way ("D DU UDU": D down, U up, a space where the
 * hand moves without hitting the strings) as a grid pattern plus the stroke
 * for each slot. Bars are 4, 8 or 16 slots (quarters, eighths, sixteenths);
 * shorter input is padded with rests.
 */
export function strumPattern(written: string): { pattern: string; strokes: string } | null {
  const raw = written.toUpperCase().replace(/[-._]/g, " ").replace(/[^DU ]/g, "");
  if (!/[DU]/.test(raw)) return null;
  const size = raw.length <= 4 ? 4 : raw.length <= 8 ? 8 : raw.length <= 16 ? 16 : 0;
  if (!size) return null;
  const slots = raw.padEnd(size, " ");
  return { pattern: slots.replace(/[DU]/g, "x").replace(/ /g, "."), strokes: slots.replace(/ /g, ".") };
}

export type HitResult = "on" | "early" | "late" | "missed";

/** On time within `tightMs`; otherwise early, late or missed. */
export function hitResult(error: number | null, tightMs = 40): HitResult {
  if (error === null) return "missed";
  if (Math.abs(error) <= tightMs) return "on";
  return error < 0 ? "early" : "late";
}
