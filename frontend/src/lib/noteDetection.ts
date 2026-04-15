/**
 * Client-side note detection from Web Audio API frequency data.
 * All functions are pure — no React deps, no side effects.
 */

export const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;

/** Convert a frequency (Hz) to the nearest MIDI note number (0–127). */
export function freqToMidi(freq: number): number {
  return Math.round(12 * Math.log2(freq / 440) + 69);
}

/** Convert a frequency to a pitch-class note name, or null if out of guitar range. */
export function freqToNoteName(freq: number): string | null {
  if (freq < 20 || freq > 5000) return null;
  const midi = freqToMidi(freq);
  if (midi < 0 || midi > 127) return null;
  return NOTE_NAMES[midi % 12];
}

export interface DetectedPeak {
  freq: number;
  noteName: string;
  midi: number;
  amplitude: number; // dB value
}

/**
 * Find the top N frequency peaks in FFT data that are above a dB threshold.
 * Uses local-maxima detection (each peak must be greater than its neighbors).
 *
 * @param frequencyData - Float32Array from AnalyserNode.getFloatFrequencyData()
 * @param sampleRate    - Audio context sample rate (e.g. 22050)
 * @param fftSize       - FFT size used when creating the AnalyserNode (e.g. 2048)
 * @param threshold     - Minimum dB level to consider (default -40)
 * @param topN          - Max peaks to return (default 6)
 */
export function detectPeaks(
  frequencyData: Float32Array,
  sampleRate: number,
  fftSize: number,
  threshold = -40,
  topN = 6
): DetectedPeak[] {
  const binResolution = sampleRate / fftSize;
  const peaks: DetectedPeak[] = [];

  for (let i = 2; i < frequencyData.length - 2; i++) {
    const amp = frequencyData[i];
    if (amp < threshold) continue;
    // Local maximum check
    if (amp <= frequencyData[i - 1] || amp <= frequencyData[i + 1]) continue;

    const freq = i * binResolution;
    const noteName = freqToNoteName(freq);
    if (!noteName) continue;

    peaks.push({ freq, noteName, midi: freqToMidi(freq), amplitude: amp });
  }

  // Sort by amplitude descending, take top N
  peaks.sort((a, b) => b.amplitude - a.amplitude);
  return peaks.slice(0, topN);
}

/**
 * Stabilize a rolling window of detected note sets.
 * Returns only notes that appear in at least `minVotes` of the recent frames.
 *
 * @param rollingWindow - Array of note-name arrays from recent frames
 * @param minVotes      - Minimum occurrences required (default 2)
 */
export function stabilizeNotes(rollingWindow: string[][], minVotes = 2): string[] {
  if (rollingWindow.length === 0) return [];

  const counts: Record<string, number> = {};
  for (const frame of rollingWindow) {
    for (const note of frame) {
      counts[note] = (counts[note] ?? 0) + 1;
    }
  }

  return Object.entries(counts)
    .filter(([, count]) => count >= minVotes)
    .map(([note]) => note);
}

/**
 * Derive a BPM number from a tempo_feel string.
 * Parses any integer in the string first; falls back to keyword mapping.
 */
export function bpmFromTempoFeel(tempoFeel: string): number {
  if (!tempoFeel) return 80;
  const match = tempoFeel.match(/\d+/);
  if (match) return Math.max(40, Math.min(220, parseInt(match[0], 10)));
  const lower = tempoFeel.toLowerCase();
  if (lower.includes("slow") || lower.includes("ballad")) return 65;
  if (lower.includes("fast") || lower.includes("upbeat") || lower.includes("uptempo")) return 130;
  if (lower.includes("medium") || lower.includes("moderate")) return 95;
  return 80;
}

/**
 * Derive beats-per-bar from a time_signature string like "4/4", "3/4", "6/8".
 */
export function beatsPerBarFromTimeSig(timeSig: string): number {
  if (!timeSig) return 4;
  const match = timeSig.match(/^(\d+)/);
  if (match) return Math.max(2, Math.min(12, parseInt(match[1], 10)));
  return 4;
}
