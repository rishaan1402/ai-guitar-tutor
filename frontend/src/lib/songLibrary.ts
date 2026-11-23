/**
 * Saved songs on your account: signed in, "Save this song" also saves it to
 * your account, so it shows up on your other devices. Everything here is best
 * effort: offline or signed out, saving on this device still works.
 */
import { getAccessToken } from "./auth";
import { listSongLibrary, removeFromSongLibrary, saveToSongLibrary, type LibrarySong } from "./api";
import type { SavedSong } from "./songStore";

const signedIn = () => typeof window !== "undefined" && !!getAccessToken();

/** Songs saved on your account ([] when signed out or offline). */
export async function accountSongs(): Promise<LibrarySong[]> {
  if (!signedIn()) return [];
  try {
    return (await listSongLibrary()).songs;
  } catch {
    return [];
  }
}

export function saveToAccount(songId: string | undefined): void {
  if (!songId || !signedIn()) return;
  saveToSongLibrary(songId).catch(() => {});
}

export function removeFromAccount(songId: string): void {
  if (!songId || !signedIn()) return;
  removeFromSongLibrary(songId).catch(() => {});
}

/** Songs saved on this device before signing in go up to the account too. */
export function pushLocalSongs(local: SavedSong[], remote: LibrarySong[]): void {
  const onAccount = new Set(remote.map((s) => s.song_id));
  for (const s of local) {
    const id = s.work.lesson.song_id;
    if (id && !onAccount.has(id)) saveToAccount(id);
  }
}

/** Account songs not on this device yet (shown in the list, opened on demand). */
export function onlyOnAccount(local: SavedSong[], remote: LibrarySong[]): LibrarySong[] {
  const here = new Set(local.map((s) => s.id));
  return remote.filter((s) => !here.has(s.song_id));
}
