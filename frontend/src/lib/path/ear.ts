/** Ear training: what the app plays for each answer, and random rounds. */

export const INTERVALS: Record<string, number> = {
  "minor 2nd": 1, "major 2nd": 2, "minor 3rd": 3, "major 3rd": 4, "perfect 4th": 5, tritone: 6,
  "perfect 5th": 7, "minor 6th": 8, "major 6th": 9, "minor 7th": 10, "major 7th": 11, octave: 12,
};

export const QUALITIES: Record<string, number[]> = {
  major: [0, 4, 7], minor: [0, 3, 7], diminished: [0, 3, 6], augmented: [0, 4, 8],
  sus2: [0, 2, 7], sus4: [0, 5, 7], "dominant 7": [0, 4, 7, 10], "major 7": [0, 4, 7, 11],
  "minor 7": [0, 3, 7, 10], "half-diminished": [0, 3, 6, 10], "power chord": [0, 7, 12],
};

export interface EarRound {
  answer: string;
  /** MIDI notes; `together` plays them as a chord. */
  notes: number[];
  together: boolean;
}

export function makeRound(mode: "interval" | "quality" | "higher", options: string[], rnd: () => number = Math.random): EarRound {
  const answer = options[Math.floor(rnd() * options.length)];
  if (mode === "interval") {
    const root = 48 + Math.floor(rnd() * 12);
    return { answer, notes: [root, root + (INTERVALS[answer] ?? 7)], together: false };
  }
  if (mode === "quality") {
    const root = 45 + Math.floor(rnd() * 10);
    return { answer, notes: (QUALITIES[answer] ?? QUALITIES.major).map((i) => root + i), together: true };
  }
  // "higher": two notes, which one is higher ("first" / "second")
  const a = 52 + Math.floor(rnd() * 14);
  const gap = 1 + Math.floor(rnd() * 4);
  const notes = answer === "second" ? [a, a + gap] : [a + gap, a];
  return { answer, notes, together: false };
}
