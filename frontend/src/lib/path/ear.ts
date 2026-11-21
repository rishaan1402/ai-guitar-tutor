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
  /** Progressions: chords played one after another. */
  chords?: number[][];
}

const DEGREE: Record<string, number> = { I: 0, II: 2, III: 4, IV: 5, V: 7, VI: 9, VII: 11 };

/** One Roman numeral ("vi", "V7", "bVII", "ii°") as semitones from the key, and its chord tones. */
export function numeralChord(numeral: string): { root: number; tones: number[] } | null {
  const m = /^(b|♭)?([ivIV]+)(°|7|maj7)?$/.exec(numeral.trim());
  if (!m) return null;
  const roman = m[2];
  const deg = DEGREE[roman.toUpperCase()];
  if (deg === undefined) return null;
  const root = (deg - (m[1] ? 1 : 0) + 12) % 12;
  const minor = roman === roman.toLowerCase();
  let tones = minor ? [0, 3, 7] : [0, 4, 7];
  if (m[3] === "°") tones = [0, 3, 6];
  if (m[3] === "7") tones = minor ? [0, 3, 7, 10] : [0, 4, 7, 10];
  if (m[3] === "maj7") tones = [0, 4, 7, 11];
  return { root, tones };
}

/** A progression like "I–V–vi–IV" voiced in a key (bass note, then the chord close above it). */
export function voiceProgression(progression: string, keyRoot: number): number[][] | null {
  const parts = progression.split(/[–\-\s]+/).filter(Boolean);
  const out: number[][] = [];
  for (const p of parts) {
    const c = numeralChord(p);
    if (!c) return null;
    const bass = 40 + ((keyRoot + c.root - 40 + 120) % 12); // E2..D#3
    const upper = c.tones.map((t) => 52 + ((keyRoot + c.root + t - 52 + 120) % 12)); // E3..D#4
    out.push([bass, ...upper.sort((a, b) => a - b)]);
  }
  return out;
}

export function makeRound(mode: "interval" | "quality" | "higher" | "progression", options: string[], rnd: () => number = Math.random): EarRound {
  const answer = options[Math.floor(rnd() * options.length)];
  if (mode === "progression") {
    const key = Math.floor(rnd() * 12);
    const chords = voiceProgression(answer, key) ?? [];
    return { answer, notes: chords.flat(), together: true, chords };
  }
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
