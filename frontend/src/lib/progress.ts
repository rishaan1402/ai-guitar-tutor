import { getAccessToken } from "./auth";
import { getProgress, type ProgressResponse, type ChordProgressItem } from "./api";

const STORAGE_KEY = "guitar-tutor-progress";

export interface ChordProgress {
  bestScore: number;
  totalAttempts: number;
  lastPracticedDate: string; // ISO date YYYY-MM-DD
  status: "not_attempted" | "in_progress" | "mastered";
}

export interface ProgressData {
  chords: Record<string, ChordProgress>;
  practiceStreak: number;
  lastPracticeDate: string | null;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function defaultProgress(): ProgressData {
  return { chords: {}, practiceStreak: 0, lastPracticeDate: null };
}

// ---------------------------------------------------------------------------
// localStorage helpers (anonymous mode)
// ---------------------------------------------------------------------------

export function loadProgressLocal(): ProgressData {
  if (typeof window === "undefined") return defaultProgress();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultProgress();
    return JSON.parse(raw) as ProgressData;
  } catch {
    return defaultProgress();
  }
}

export function saveProgress(data: ProgressData): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// ---------------------------------------------------------------------------
// Dual-mode: API if authenticated, localStorage otherwise
// ---------------------------------------------------------------------------

/** Convert API response to the local ProgressData shape. */
function apiToProgressData(apiData: ProgressResponse): ProgressData {
  const chords: Record<string, ChordProgress> = {};
  for (const c of apiData.chords) {
    const status: ChordProgress["status"] = c.mastered
      ? "mastered"
      : c.total_attempts > 0
      ? "in_progress"
      : "not_attempted";
    chords[c.chord_name] = {
      bestScore: c.best_score,
      totalAttempts: c.total_attempts,
      lastPracticedDate: c.last_practiced ?? today(),
      status,
    };
  }
  return {
    chords,
    practiceStreak: apiData.practice_streak,
    lastPracticeDate: null,
  };
}

/**
 * Load progress — from API if logged in, from localStorage otherwise.
 * For backward compatibility with components that call this synchronously,
 * this returns localStorage data immediately.
 * Components that want the live API data should call loadProgressAsync().
 */
export function loadProgress(): ProgressData {
  return loadProgressLocal();
}

/** Async version — fetches from API when authenticated. */
export async function loadProgressAsync(): Promise<ProgressData> {
  if (typeof window !== "undefined" && getAccessToken()) {
    try {
      const apiData = await getProgress();
      return apiToProgressData(apiData);
    } catch {
      // fall through to localStorage
    }
  }
  return loadProgressLocal();
}

export function recordAttempt(chord: string, score: number): ProgressData {
  const data = loadProgressLocal();
  const existing = data.chords[chord];
  const todayStr = today();

  const bestScore = existing ? Math.max(existing.bestScore, score) : score;
  const totalAttempts = existing ? existing.totalAttempts + 1 : 1;
  const status: ChordProgress["status"] = bestScore >= 0.95 ? "mastered" : "in_progress";

  data.chords[chord] = { bestScore, totalAttempts, lastPracticedDate: todayStr, status };

  // Update streak
  if (data.lastPracticeDate === todayStr) {
    // Already practiced today, no change
  } else if (data.lastPracticeDate === yesterday()) {
    data.practiceStreak += 1;
  } else {
    data.practiceStreak = 1;
  }
  data.lastPracticeDate = todayStr;

  saveProgress(data);
  return data;
}

export function getChordStatus(chord: string): ChordProgress["status"] {
  const data = loadProgressLocal();
  return data.chords[chord]?.status || "not_attempted";
}

export function getProgressSummary(data: ProgressData): {
  totalPracticed: number;
  averageBestScore: number;
  streak: number;
  masteredCount: number;
} {
  const entries = Object.values(data.chords);
  const totalPracticed = entries.length;
  const averageBestScore =
    totalPracticed > 0
      ? entries.reduce((sum, e) => sum + e.bestScore, 0) / totalPracticed
      : 0;
  const masteredCount = entries.filter((e) => e.status === "mastered").length;

  return {
    totalPracticed,
    averageBestScore,
    streak: data.practiceStreak,
    masteredCount,
  };
}

// Re-export API type for convenience
export type { ChordProgressItem, ProgressResponse };
