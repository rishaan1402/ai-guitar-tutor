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

export function loadProgress(): ProgressData {
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

export function recordAttempt(chord: string, score: number): ProgressData {
  const data = loadProgress();
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
  const data = loadProgress();
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
