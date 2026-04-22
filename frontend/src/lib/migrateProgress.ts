/**
 * One-time migration of localStorage progress data to the backend DB.
 * Called after first successful login or signup.
 * Sets a flag so it only runs once per browser.
 */

import { migrateProgress, migrateTransitions } from "./api";

const MIGRATION_FLAG = "guitar_tutor_migrated";

const PROGRESS_KEY = "guitar-tutor-progress";
const TRANSITIONS_KEY = "guitar-tutor-transitions";

export async function runMigration(): Promise<void> {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(MIGRATION_FLAG)) return;

  const errors: string[] = [];

  // Migrate chord progress
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (raw) {
      const data = JSON.parse(raw) as {
        chords: Record<
          string,
          { bestScore: number; totalAttempts: number; lastPracticedDate: string }
        >;
      };

      for (const [chord, prog] of Object.entries(data.chords)) {
        await migrateProgress({
          chord_name: chord,
          best_score: prog.bestScore,
          total_attempts: prog.totalAttempts,
          last_practiced: prog.lastPracticedDate || null,
        }).catch(() => {}); // ignore per-chord errors
      }
    }
  } catch (e) {
    errors.push(`progress: ${e}`);
  }

  // Migrate transition history
  try {
    const raw = localStorage.getItem(TRANSITIONS_KEY);
    if (raw) {
      const items = JSON.parse(raw) as {
        chordA: string;
        chordB: string;
        chordASymbol: string;
        chordBSymbol: string;
        tpm: number;
        gotCount: number;
        missCount: number;
        date: string;
      }[];

      if (items.length > 0) {
        await migrateTransitions(
          items.map((i) => ({
            chord_a: i.chordA,
            chord_b: i.chordB,
            chord_a_symbol: i.chordASymbol,
            chord_b_symbol: i.chordBSymbol,
            tpm: i.tpm,
            got_count: i.gotCount,
            miss_count: i.missCount,
            date: i.date,
          }))
        ).catch(() => {});
      }
    }
  } catch (e) {
    errors.push(`transitions: ${e}`);
  }

  if (errors.length === 0) {
    localStorage.setItem(MIGRATION_FLAG, "1");
  }
}
