/**
 * localStorage helpers for Chord Transition Trainer results.
 * All functions guard against SSR (no window).
 */

const STORAGE_KEY = "guitar-tutor-transitions";

export interface TransitionResult {
  chordA: string;          // e.g. "G_major"
  chordB: string;          // e.g. "C_major"
  chordASymbol: string;    // e.g. "G"
  chordBSymbol: string;    // e.g. "C"
  date: string;            // ISO YYYY-MM-DD
  tpm: number;             // transitions per minute (gotCount + missCount)
  gotCount: number;
  missCount: number;
}

export function loadTransitionHistory(): TransitionResult[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as TransitionResult[];
  } catch {
    return [];
  }
}

export function saveTransitionResult(result: TransitionResult): void {
  if (typeof window === "undefined") return;
  try {
    const history = loadTransitionHistory();
    history.unshift(result); // newest first
    // Keep last 100 results
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, 100)));
  } catch {
    // ignore localStorage errors (private mode, full storage, etc.)
  }
}

/**
 * Get all sessions for a specific chord pair (in either order), newest first.
 */
export function getTransitionStats(chordA: string, chordB: string): TransitionResult[] {
  const history = loadTransitionHistory();
  return history.filter(
    (r) =>
      (r.chordA === chordA && r.chordB === chordB) ||
      (r.chordA === chordB && r.chordB === chordA)
  );
}
