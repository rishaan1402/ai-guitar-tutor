/**
 * Placement: find where an experienced player should start in a track.
 * Level by level, a short probe (a few of the level's quiz questions, or
 * "can you already do this?" when it has none). The first level you don't
 * pass is where you start. Earlier levels stay open; they're just marked
 * as tested out (no stars are faked).
 */
import { isCheck, TRACKS } from "./curriculum";
import type { PathLevel, Question } from "./steps";

export interface Probe {
  level: PathLevel;
  /** Up to three of the level's questions; empty means a self-report. */
  questions: Question[];
}

export function probesFor(trackId: string): Probe[] {
  const track = TRACKS.find((t) => t.id === trackId);
  if (!track) return [];
  return track.levels.map((level) => {
    const qs = level.sessions.filter((s) => !isCheck(s.id)).flatMap((s) => s.steps.flatMap((st) => (st.kind === "quiz" ? st.questions : [])));
    // spread the picks across the level: early, middle, late
    const pick = qs.length <= 3 ? qs : [qs[0], qs[Math.floor(qs.length / 2)], qs[qs.length - 1]];
    return { level, questions: pick };
  });
}

/** A probe passes with at most one wrong answer (or a yes on the self-report). */
export const probePassed = (right: number, total: number) => (total === 0 ? right > 0 : right >= Math.max(1, total - 1));

const KEY = "os:placement";

/** Level id each track starts at, per this device. */
export function loadPlacements(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}

export function savePlacement(trackId: string, levelId: string | null): void {
  const all = loadPlacements();
  if (levelId) all[trackId] = levelId;
  else delete all[trackId];
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* storage blocked */
  }
}

/** Levels before the placed level are tested out. */
export function testedOut(trackId: string, levelId: string, placements: Record<string, string>): boolean {
  const start = placements[trackId];
  const track = TRACKS.find((t) => t.id === trackId);
  if (!start || !track) return false;
  const i = track.levels.findIndex((l) => l.id === levelId);
  const s = track.levels.findIndex((l) => l.id === start);
  return i >= 0 && s >= 0 && i < s;
}
