/**
 * Learn any song, kept:
 * - the song you're working on (and your chord scores) survives leaving the page:
 *   practise a chord, open a lesson, come back and it's all still there;
 * - "Save this song" keeps the whole breakdown on this device, to reopen later
 *   without generating it again.
 */
import type { LessonDocument } from "./api";

export interface SongWork {
  lesson: LessonDocument;
  chordScores: Record<string, number>;
  chordScoreHistory: Record<string, number[]>;
  allChordsAttempted: boolean;
  attemptCounts: Record<string, number>;
}

export interface SavedSong {
  id: string;
  title: string;
  artist: string;
  savedAt: number;
  work: SongWork;
}

const CURRENT = "os:song-current";
const SAVED = "os:saved-songs";
const MAX_SAVED = 30;

function read<T>(store: Storage | undefined, key: string): T | null {
  try {
    const raw = store?.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(store: Storage | undefined, key: string, value: unknown): void {
  try {
    store?.setItem(key, JSON.stringify(value));
  } catch {
    /* storage blocked or full: nothing breaks, it just isn't kept */
  }
}

const local = () => (typeof window === "undefined" ? undefined : window.localStorage);

/** The song in progress (kept for this device until you search another). */
export const loadCurrentSong = () => read<SongWork>(local(), CURRENT);
export const saveCurrentSong = (w: SongWork | null) => (w ? write(local(), CURRENT, w) : local()?.removeItem(CURRENT));

export function listSavedSongs(): SavedSong[] {
  return (read<SavedSong[]>(local(), SAVED) ?? []).sort((a, b) => b.savedAt - a.savedAt);
}

export const isSongSaved = (lessonId: string) => listSavedSongs().some((s) => s.id === lessonId);

export function saveSong(work: SongWork): void {
  const others = listSavedSongs().filter((s) => s.id !== work.lesson.lesson_id);
  const entry: SavedSong = { id: work.lesson.lesson_id, title: work.lesson.song_title || "Untitled song", artist: work.lesson.artist || "", savedAt: Date.now(), work };
  write(local(), SAVED, [entry, ...others].slice(0, MAX_SAVED));
}

/** Keep a saved song's scores up to date as you practise. */
export function updateSavedSong(work: SongWork): void {
  const all = listSavedSongs();
  const i = all.findIndex((s) => s.id === work.lesson.lesson_id);
  if (i < 0) return;
  all[i] = { ...all[i], work };
  write(local(), SAVED, all);
}

export function removeSavedSong(lessonId: string): void {
  write(local(), SAVED, listSavedSongs().filter((s) => s.id !== lessonId));
}
