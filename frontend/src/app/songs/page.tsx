"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAuth } from "@/context/AuthContext";
import { listSongs, type SongSummary } from "@/lib/api";

const DIFFICULTIES = ["beginner", "intermediate", "advanced"] as const;
type SourceFilter = "all" | SongSummary["source"];

const SOURCE_LABEL: Record<SongSummary["source"], string> = {
  library: "Library",
  mine: "My sheets",
  class: "From my class",
};

const chip = (on: boolean) =>
  `px-3 py-1 rounded-full text-sm border transition-colors capitalize ${
    on ? "border-violet-400/60 bg-violet-500/20 text-violet-100" : "border-white/10 text-gray-400 hover:text-white"
  }`;

export default function SongsPage() {
  const { user } = useAuth();
  const [songs, setSongs] = useState<SongSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [difficulty, setDifficulty] = useState<string | null>(null);
  const [source, setSource] = useState<SourceFilter>("all");

  // Debounce typing so search doesn't fire on every keystroke
  useEffect(() => {
    const t = setTimeout(() => {
      listSongs({ q: q.trim() || undefined, difficulty: difficulty ?? undefined })
        .then((s) => {
          setSongs(s);
          setError(null);
        })
        .catch((err) => setError(err instanceof Error ? err.message : "Could not load songs"));
    }, 200);
    return () => clearTimeout(t);
  }, [q, difficulty, user]);

  const sources = useMemo(
    () => (["library", "mine", "class"] as const).filter((s) => songs?.some((x) => x.source === s)),
    [songs],
  );
  const shown = (songs ?? []).filter((s) => source === "all" || s.source === source);

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto">
        <SectionHeader
          as="h1"
          title="Songs"
          subtitle="Chord charts and tabs with transpose, capo, simplify and autoscroll"
          action={
            user ? (
              <Link href="/songs/edit" className="btn-gradient text-sm px-4 py-2">
                New sheet
              </Link>
            ) : null
          }
        />

        <div className="space-y-3 mb-6">
          <label htmlFor="song-search" className="sr-only">Search songs</label>
          <input
            id="song-search"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by title or artist"
            className="field-input"
          />
          <div className="flex flex-wrap gap-2">
            {DIFFICULTIES.map((d) => (
              <button
                key={d}
                type="button"
                className={chip(difficulty === d)}
                onClick={() => setDifficulty(difficulty === d ? null : d)}
                aria-pressed={difficulty === d}
              >
                {d}
              </button>
            ))}
            {sources.length > 1 && <span className="w-px bg-white/10 mx-1" aria-hidden />}
            {sources.length > 1 &&
              (["all", ...sources] as SourceFilter[]).map((s) => (
                <button key={s} type="button" className={chip(source === s)} onClick={() => setSource(s)} aria-pressed={source === s}>
                  {s === "all" ? "All" : SOURCE_LABEL[s]}
                </button>
              ))}
          </div>
        </div>

        {error ? (
          <EmptyState title="Couldn't load songs" description={error} />
        ) : songs === null ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton h-14 rounded-xl" />
            ))}
          </div>
        ) : shown.length === 0 ? (
          <EmptyState
            title="No songs match"
            description={q || difficulty ? "Try a different search or filter." : "Nothing here yet."}
          />
        ) : (
          <ul className="panel divide-y divide-white/5 overflow-hidden">
            {shown.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/songs/view?id=${encodeURIComponent(s.id)}`}
                  className="flex items-center gap-4 px-4 py-3 panel-row-hover"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-white font-medium truncate">{s.title}</p>
                    <p className="text-sm text-gray-500 truncate">
                      {s.artist ?? "Unknown artist"}
                      {s.source !== "library" && (
                        <span className="text-gray-600">
                          {" · "}
                          {s.source === "class" ? `Shared by ${s.owner_name}` : s.visibility === "class" ? "Shared with class" : "Private"}
                        </span>
                      )}
                    </p>
                  </div>
                  {s.key && <span className="text-sm text-gray-400 shrink-0">Key {s.key}</span>}
                  {s.difficulty && (
                    <span className="hidden sm:inline text-xs capitalize text-gray-400 border border-white/10 rounded-full px-2 py-0.5 shrink-0">
                      {s.difficulty}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}

        <p className="text-xs text-gray-600 mt-6">
          Library sheets are chord charts of traditional songs and practice progressions. They don&apos;t include lyrics.
        </p>
      </div>
    </AppShell>
  );
}
