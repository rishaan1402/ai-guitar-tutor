/** Chord-key helpers shared across the app ("A#_half_dim7" → "A# half dim7"). */

export function formatChord(key: string | null | undefined): string {
  if (!key) return "";
  return key.replace(/_/g, " ");
}

/** Open chords a beginner learns first, in teaching order. */
export const BEGINNER_PATH = [
  "E_minor",
  "A_minor",
  "E_major",
  "A_major",
  "D_major",
  "G_major",
  "C_major",
  "D_minor",
] as const;

/**
 * The chord after `current` on the beginner path (wraps around). Chords not
 * on the path start the path from the beginning.
 */
export function nextBeginnerChord(current: string): string {
  const i = (BEGINNER_PATH as readonly string[]).indexOf(current);
  if (i === -1) return BEGINNER_PATH[0];
  return BEGINNER_PATH[(i + 1) % BEGINNER_PATH.length];
}

const QUALITY_SYMBOL: Record<string, string> = {
  major: "",
  minor: "m",
  dominant7: "7",
  major7: "maj7",
  minor7: "m7",
  half_dim7: "m7♭5",
  power: "5",
};

/** Chord key to its symbol: "A#_half_dim7" → "A#m7♭5", "E_minor" → "Em". */
export function chordSymbol(key: string): string {
  const i = key.indexOf("_");
  if (i < 0) return key;
  const q = key.slice(i + 1);
  return key.slice(0, i) + (QUALITY_SYMBOL[q] ?? ` ${q.replace(/_/g, " ")}`);
}
