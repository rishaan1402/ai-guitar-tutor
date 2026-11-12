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
