import { describe, it, expect } from "vitest";
import {
  freqToNoteName,
  detectPeaks,
  stabilizeNotes,
  bpmFromTempoFeel,
  beatsPerBarFromTimeSig,
} from "../noteDetection";

// ---------------------------------------------------------------------------
// freqToNoteName
// ---------------------------------------------------------------------------

describe("freqToNoteName", () => {
  it("A4 (440 Hz) → A", () => {
    expect(freqToNoteName(440)).toBe("A");
  });

  it("E2 (82.4 Hz) → E — open low E string", () => {
    expect(freqToNoteName(82.4)).toBe("E");
  });

  it("G4 (392 Hz) → G", () => {
    expect(freqToNoteName(392)).toBe("G");
  });

  it("returns null for freq below 20 Hz", () => {
    expect(freqToNoteName(19)).toBeNull();
  });

  it("returns null for freq above 5000 Hz", () => {
    expect(freqToNoteName(5001)).toBeNull();
  });

  it("returns null for 0 Hz", () => {
    expect(freqToNoteName(0)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// detectPeaks
// ---------------------------------------------------------------------------

describe("detectPeaks", () => {
  it("returns empty array for empty input", () => {
    expect(detectPeaks(new Float32Array(0), 44100, 2048)).toEqual([]);
  });

  it("returns empty array when all values below threshold", () => {
    const data = new Float32Array(512).fill(-80);
    expect(detectPeaks(data, 44100, 2048)).toEqual([]);
  });

  it("detects a single clear peak above threshold", () => {
    const SR = 22050;
    const FFT = 2048;
    const binRes = SR / FFT; // ~10.77 Hz per bin
    // A4 is 440 Hz → bin ≈ 41
    const A4_BIN = Math.round(440 / binRes);
    const data = new Float32Array(FFT / 2).fill(-80);
    data[A4_BIN - 1] = -60;
    data[A4_BIN] = -30; // peak
    data[A4_BIN + 1] = -60;

    const peaks = detectPeaks(data, SR, FFT, -40, 6);
    expect(peaks.length).toBeGreaterThan(0);
    expect(peaks[0].noteName).toBe("A");
  });

  it("respects topN limit", () => {
    const SR = 22050;
    const FFT = 2048;
    const data = new Float32Array(FFT / 2).fill(-80);
    // Create 10 equally spaced peaks well above threshold
    for (let i = 0; i < 10; i++) {
      const bin = 20 + i * 30;
      data[bin - 1] = -50;
      data[bin] = -20;
      data[bin + 1] = -50;
    }
    const peaks = detectPeaks(data, SR, FFT, -40, 4);
    expect(peaks.length).toBeLessThanOrEqual(4);
  });
});

// ---------------------------------------------------------------------------
// stabilizeNotes
// ---------------------------------------------------------------------------

describe("stabilizeNotes", () => {
  it("returns empty array for empty window", () => {
    expect(stabilizeNotes([])).toEqual([]);
  });

  it("excludes notes appearing below minVotes", () => {
    // "G" in 1 of 3 frames with minVotes=2 → excluded
    const window = [["G"], ["A"], ["A"]];
    const stable = stabilizeNotes(window, 2);
    expect(stable).not.toContain("G");
    expect(stable).toContain("A");
  });

  it("includes notes appearing at or above minVotes", () => {
    const window = [["G", "B"], ["G", "D"], ["G", "B"]];
    const stable = stabilizeNotes(window, 2);
    expect(stable).toContain("G");
    expect(stable).toContain("B");
  });

  it("minVotes=1 includes any note seen at least once", () => {
    const window = [["C"], ["D"], ["E"]];
    const stable = stabilizeNotes(window, 1);
    expect(stable).toContain("C");
    expect(stable).toContain("D");
    expect(stable).toContain("E");
  });
});

// ---------------------------------------------------------------------------
// bpmFromTempoFeel
// ---------------------------------------------------------------------------

describe("bpmFromTempoFeel", () => {
  it("empty string → 80", () => {
    expect(bpmFromTempoFeel("")).toBe(80);
  });

  it("'slow' → 65", () => {
    expect(bpmFromTempoFeel("slow")).toBe(65);
  });

  it("'fast' → 130", () => {
    expect(bpmFromTempoFeel("fast")).toBe(130);
  });

  it("'medium' → 95", () => {
    expect(bpmFromTempoFeel("medium")).toBe(95);
  });

  it("parses embedded number '120 bpm' → 120", () => {
    expect(bpmFromTempoFeel("120 bpm")).toBe(120);
  });

  it("parses embedded number '90' → 90", () => {
    expect(bpmFromTempoFeel("90")).toBe(90);
  });
});

// ---------------------------------------------------------------------------
// beatsPerBarFromTimeSig
// ---------------------------------------------------------------------------

describe("beatsPerBarFromTimeSig", () => {
  it("empty string → 4", () => {
    expect(beatsPerBarFromTimeSig("")).toBe(4);
  });

  it("'4/4' → 4", () => {
    expect(beatsPerBarFromTimeSig("4/4")).toBe(4);
  });

  it("'3/4' → 3", () => {
    expect(beatsPerBarFromTimeSig("3/4")).toBe(3);
  });

  it("'6/8' → 6", () => {
    expect(beatsPerBarFromTimeSig("6/8")).toBe(6);
  });
});
