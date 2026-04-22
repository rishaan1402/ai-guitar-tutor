/**
 * localStorage helpers for Chord Transition Trainer results.
 * When authenticated, also persists to the backend API.
 * All functions guard against SSR (no window).
 */

import { getAccessToken } from "./auth";
import { saveTransitionDrill, getTransitionHistory as apiGetHistory } from "./api";

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

/** Async version — fetches from API when authenticated. */
export async function loadTransitionHistoryAsync(): Promise<TransitionResult[]> {
  if (typeof window !== "undefined" && getAccessToken()) {
    try {
      const items = await apiGetHistory();
      return items.map((i) => ({
        chordA: i.chord_a,
        chordB: i.chord_b,
        chordASymbol: i.chord_a_symbol,
        chordBSymbol: i.chord_b_symbol,
        date: i.created_at.slice(0, 10),
        tpm: i.tpm,
        gotCount: i.got_count,
        missCount: i.miss_count,
      }));
    } catch {
      // fall through to localStorage
    }
  }
  return loadTransitionHistory();
}

export function saveTransitionResult(result: TransitionResult): void {
  if (typeof window === "undefined") return;

  // Always save to localStorage for instant feedback
  try {
    const history = loadTransitionHistory();
    history.unshift(result); // newest first
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, 100)));
  } catch {
    // ignore localStorage errors
  }

  // If authenticated, also persist to API (fire-and-forget)
  if (getAccessToken()) {
    saveTransitionDrill({
      chord_a: result.chordA,
      chord_b: result.chordB,
      chord_a_symbol: result.chordASymbol,
      chord_b_symbol: result.chordBSymbol,
      tpm: result.tpm,
      got_count: result.gotCount,
      miss_count: result.missCount,
    }).catch(() => {}); // ignore errors
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
