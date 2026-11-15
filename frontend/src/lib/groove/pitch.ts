/**
 * Single-note detection for lead: pitch (McLeod, via pitchy) plus pluck onsets,
 * so a repeated note counts as a new note when you pluck it again.
 */
import { PitchDetector } from "pitchy";

export interface HeardNote {
  midi: number;
  hz: number;
  time: number;
}

export class NoteTracker {
  private detector: PitchDetector<Float32Array>;
  private lastRms = 0;
  private lastMidi: number | null = null;
  private candidate: number | null = null;
  private count = 0;
  private armed = true;
  level = 0;

  constructor(size: number, private minClarity = 0.88) {
    this.detector = PitchDetector.forFloat32Array(size);
  }

  /** One frame of time-domain samples; returns a note when a new one is confirmed. */
  feed(samples: Float32Array, sampleRate: number, time: number): HeardNote | null {
    let sum = 0;
    for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
    const rms = Math.sqrt(sum / samples.length);
    this.level = rms;
    const onset = rms > 0.01 && rms > this.lastRms * 1.8;
    this.lastRms = rms * 0.7 + this.lastRms * 0.3;
    if (rms < 0.006) {
      this.candidate = null;
      this.count = 0;
      this.armed = true;
      return null;
    }
    if (onset) this.armed = true;
    const [hz, clarity] = this.detector.findPitch(samples, sampleRate);
    if (clarity < this.minClarity || hz < 70 || hz > 1400) return null;
    const midi = Math.round(69 + 12 * Math.log2(hz / 440));
    if (midi === this.candidate) this.count++;
    else {
      this.candidate = midi;
      this.count = 1;
    }
    // report when stable, and either a new pluck or a different note
    if (this.count >= 2 && (this.armed || midi !== this.lastMidi)) {
      this.armed = false;
      this.lastMidi = midi;
      return { midi, hz, time };
    }
    return null;
  }
}
