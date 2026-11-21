"use client";

/** Songs you've saved from Learn any song: reopen instantly, no new search. */
import { useEffect, useState } from "react";
import { listSavedSongs, removeSavedSong, type SavedSong, type SongWork } from "@/lib/songStore";

export default function SavedSongs({ currentId, onOpen }: { currentId: string | null; onOpen: (w: SongWork) => void }) {
  const [songs, setSongs] = useState<SavedSong[]>([]);
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
  if (!songs.length) return null;
  return (
    <section aria-labelledby="saved-songs-h" className="mx-auto mt-10 max-w-3xl">
      <h2 id="saved-songs-h" className="label-mono text-amber-400">Your saved songs</h2>
      <ul className="mt-3 grid gap-2 landscape:grid-cols-2">
        {songs.map((s) => {
          const scores = Object.values(s.work.chordScores ?? {});
          const open = s.id === currentId;
          return (
            <li key={s.id} className={`flex items-center gap-3 rounded-2xl border p-3 ${open ? "border-amber-400/50 bg-amber-400/5" : "border-cream/10"}`}>
              <button type="button" onClick={() => onOpen(s.work)} className="min-w-0 flex-1 text-left">
                <span className="block truncate font-semibold text-cream">{s.title}</span>
                <span className="block truncate text-sm text-cream/55">
                  {s.artist ? `${s.artist} · ` : ""}
                  {scores.length ? `${scores.length} chord${scores.length > 1 ? "s" : ""} practised` : "not practised yet"}
                  {open ? " · open" : ""}
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  removeSavedSong(s.id);
                  setSongs(listSavedSongs());
                }}
                aria-label={`Remove ${s.title} from saved songs`}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-cream/40 hover:text-amp-300"
              >
                ✕
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
