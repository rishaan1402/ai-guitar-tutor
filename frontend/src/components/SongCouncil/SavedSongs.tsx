"use client";

/**
 * Songs you've saved from Learn any song: reopen instantly, no new search.
 * Signed in, the list also shows songs saved on your account from another
 * device; opening one fetches it from the song library (no AI generation).
 */
import { useEffect, useState } from "react";
import { resumeSongSession, type LibrarySong } from "@/lib/api";
import { listSavedSongs, removeSavedSong, saveSong, type SavedSong, type SongWork } from "@/lib/songStore";
import { accountSongs, onlyOnAccount, pushLocalSongs, removeFromAccount } from "@/lib/songLibrary";

export default function SavedSongs({ currentId, onOpen }: { currentId: string | null; onOpen: (w: SongWork) => void }) {
  const [songs, setSongs] = useState<SavedSong[]>([]);
  const [remote, setRemote] = useState<LibrarySong[]>([]);
  const [opening, setOpening] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // re-read when the open song changes (it may have just been saved)
  useEffect(() => setSongs(listSavedSongs()), [currentId]);
  useEffect(() => {
    const refresh = () => setSongs(listSavedSongs());
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  useEffect(() => {
    let live = true;
    accountSongs().then((r) => {
      if (!live) return;
      setRemote(r);
      pushLocalSongs(listSavedSongs(), r);
    });
    return () => {
      live = false;
    };
  }, []);

  const elsewhere = onlyOnAccount(songs, remote);
  if (!songs.length && !elsewhere.length) return null;

  async function openFromAccount(s: LibrarySong) {
    setOpening(s.song_id);
    setError(null);
    try {
      const r = await resumeSongSession(s.song_id);
      const work: SongWork = { lesson: r.lesson, chordScores: {}, chordScoreHistory: {}, allChordsAttempted: false, attemptCounts: {} };
      saveSong(work);
      setSongs(listSavedSongs());
      onOpen(work);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't open that song.");
    } finally {
      setOpening(null);
    }
  }

  function remove(id: string) {
    removeSavedSong(id);
    removeFromAccount(id);
    setSongs(listSavedSongs());
    setRemote((r) => r.filter((s) => s.song_id !== id));
  }

  return (
    <section aria-labelledby="saved-songs-h" className="mx-auto mt-10 max-w-3xl">
      <h2 id="saved-songs-h" className="label-mono text-amber-400">Your saved songs</h2>
      {error && <p role="alert" className="mt-2 text-sm text-amp-300">{error}</p>}
      <ul className="mt-3 grid gap-2 landscape:grid-cols-2">
        {songs.map((s) => {
          const scores = Object.values(s.work.chordScores ?? {});
          const open = s.id === currentId;
          return (
            <Row
              key={s.id}
              title={s.title}
              detail={`${s.artist ? `${s.artist} · ` : ""}${scores.length ? `${scores.length} chord${scores.length > 1 ? "s" : ""} practised` : "not practised yet"}${open ? " · open" : ""}`}
              open={open}
              onOpen={() => onOpen(s.work)}
              onRemove={() => remove(s.id)}
            />
          );
        })}
        {elsewhere.map((s) => (
          <Row
            key={s.song_id}
            title={s.title}
            detail={`${s.artist ? `${s.artist} · ` : ""}${opening === s.song_id ? "opening…" : "saved on another device"}`}
            open={false}
            onOpen={() => openFromAccount(s)}
            onRemove={() => remove(s.song_id)}
          />
        ))}
      </ul>
    </section>
  );
}

function Row({ title, detail, open, onOpen, onRemove }: { title: string; detail: string; open: boolean; onOpen: () => void; onRemove: () => void }) {
  return (
    <li className={`flex items-center gap-3 rounded-2xl border p-3 ${open ? "border-amber-400/50 bg-amber-400/5" : "border-cream/10"}`}>
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
        <span className="block truncate font-semibold text-cream">{title}</span>
        <span className="block truncate text-sm text-cream/60">{detail}</span>
      </button>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${title} from saved songs`}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-cream/50 hover:text-amp-300"
      >
        ✕
      </button>
    </li>
  );
}
