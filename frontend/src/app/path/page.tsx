"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppMenu } from "@/components/NavBar";
import { isCheck, nextSession, TRACKS } from "@/lib/path/curriculum";
import { loadPathProgress } from "@/lib/path/progress";
import { listSongLessons, songSessionId } from "@/lib/path/songLesson";
import { loadPlacements, savePlacement, testedOut } from "@/lib/path/placement";
import { canReview, reviewId } from "@/lib/path/review";

/** Today on this device, YYYY-MM-DD. */
function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const TRACK_KEY = "os:path-track";

/** The learning path: four tracks of levels, each a ladder from day one to pro, plus your song lessons. */
export default function PathPage() {
  const [done, setDone] = useState<Record<string, number> | null>(null);
  const [trackId, setTrackId] = useState(TRACKS[0].id);
  const [songs, setSongs] = useState<ReturnType<typeof listSongLessons>>([]);
  const [placements, setPlacements] = useState<Record<string, string>>({});
  const [day, setDay] = useState("");
  useEffect(() => {
    loadPathProgress().then(setDone);
    setSongs(listSongLessons());
    setPlacements(loadPlacements());
    setDay(today());
    try {
      const t = new URLSearchParams(window.location.search).get("track") ?? localStorage.getItem(TRACK_KEY);
      if (t && TRACKS.some((x) => x.id === t)) setTrackId(t);
    } catch {
      /* storage blocked */
    }
  }, []);
  const pick = (id: string) => {
    setTrackId(id);
    try {
      localStorage.setItem(TRACK_KEY, id);
    } catch {
      /* storage blocked */
    }
  };
  const track = TRACKS.find((t) => t.id === trackId)!;
  const next = done ? nextSession(done, track.id, placements[track.id]) : null;
  const placedLevel = track.levels.find((l) => l.id === placements[track.id]);
  const reviewDone = !!day && (done?.[reviewId(day)] ?? 0) > 0;
  const resetPlacement = () => {
    savePlacement(track.id, null);
    setPlacements(loadPlacements());
  };
  const sessionsIn = (t: (typeof TRACKS)[number]) => t.levels.flatMap((l) => l.sessions);

  return (
    <main className="min-h-[100dvh] bg-ink-950 px-4 pb-12 pt-[max(1rem,env(safe-area-inset-top))] landscape:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1">
            <AppMenu className="-ml-2" />
            <Link href="/studio" className="label-mono whitespace-nowrap text-cream/60">← Studio</Link>
          </span>
          <div className="flex items-center gap-3">
            <Link href="/practice" className="whitespace-nowrap rounded-full border border-amber-400/40 px-3 py-1 text-sm font-semibold text-amber-100">Chords</Link>
            <p className="label-mono whitespace-nowrap text-cream/60">
              {done ? Object.values(done).filter((n) => n > 0).length : 0} lessons done
            </p>
          </div>
        </div>
        <h1 className="mt-3 font-display text-h2 uppercase text-cream">Lessons</h1>

        {/* tracks */}
        <div role="tablist" aria-label="Tracks" className="mt-4 grid grid-cols-2 gap-2 landscape:grid-cols-4">
          {TRACKS.map((t) => {
            const list = sessionsIn(t);
            const n = list.filter((s) => (done?.[s.id] ?? 0) > 0).length;
            const active = t.id === trackId;
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={active}
                onClick={() => pick(t.id)}
                className={`rounded-2xl border p-3 text-left ${active ? "border-amber-400 bg-amber-400/10" : "border-cream/10"}`}
              >
                <span className={`block font-semibold ${active ? "text-amber-100" : "text-cream"}`}>{t.title}</span>
                <span className="mt-1 block h-1 overflow-hidden rounded-full bg-cream/10">
                  <span className="block h-full rounded-full bg-amber-400" style={{ width: `${(n / list.length) * 100}%` }} />
                </span>
                <span className="label-mono mt-1 block text-[10px] text-cream/45">{n}/{list.length}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-3 max-w-prose text-sm text-cream/60">{track.blurb}</p>

        <p className="mt-2 text-sm text-cream/55">
          {placedLevel ? (
            <>
              Starting from <span className="text-cream">{placedLevel.title}</span> ·{" "}
              <Link href={`/path/placement?track=${track.id}`} className="text-amber-300 underline-offset-4 hover:underline">Retake</Link> ·{" "}
              <button onClick={resetPlacement} className="text-amber-300 underline-offset-4 hover:underline">Start from the beginning</button>
            </>
          ) : (
            <Link href={`/path/placement?track=${track.id}`} className="text-amber-300 underline-offset-4 hover:underline">Not a beginner? Find your level →</Link>
          )}
        </p>

        <div className="mt-4 grid gap-2 landscape:grid-cols-[2fr_1fr]">
          {next && (
            <Link href={`/path/session?id=${next.id}`} className="flex items-center justify-between gap-4 rounded-[22px] bg-amber-400 px-5 py-4 text-ink-950">
              <span className="min-w-0">
                <span className="label-mono block text-ink-950/60">Up next</span>
                <span className="mt-1 block truncate font-display text-xl uppercase">{next.title}</span>
                <span className="mt-0.5 block truncate text-sm text-ink-950/70">{next.blurb}</span>
              </span>
              <span className="text-3xl" aria-hidden="true">→</span>
            </Link>
          )}
          {done && canReview(done) && (
            <Link href="/path/session?review=1" className={`flex items-center justify-between gap-3 rounded-[22px] border px-5 py-4 ${reviewDone ? "border-sage-300/40 text-sage-100" : "border-amber-400/50 text-cream"}`}>
              <span className="min-w-0">
                <span className="label-mono block text-[10px] text-cream/50">Daily review</span>
                <span className="mt-1 block font-semibold">{reviewDone ? "Done today ✓" : "10 minutes on weak spots"}</span>
              </span>
              <span className="text-2xl" aria-hidden="true">↻</span>
            </Link>
          )}
        </div>

        {songs.length > 0 && (
          <section aria-labelledby="songs-h" className="mt-8">
            <h2 id="songs-h" className="font-display text-lg uppercase text-cream">Your song lessons</h2>
            <ul className="mt-3 grid gap-2 landscape:grid-cols-2">
              {songs.map((s) => {
                const stars = done?.[songSessionId(s.slug)] ?? 0;
                return (
                  <li key={s.slug}>
                    <Link href={`/path/session?song=${encodeURIComponent(s.slug)}`} className="flex items-center gap-3 rounded-2xl border border-cream/10 p-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cream/5 text-lg" aria-hidden="true">♪</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-cream">{s.title}</span>
                        {s.artist && <span className="block truncate text-sm text-cream/55">{s.artist}</span>}
                      </span>
                      <Stars n={stars} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <div className="mt-8 space-y-8">
          {track.levels.map((level) => {
            const earned = level.sessions.reduce((n, s) => n + (done?.[s.id] ?? 0), 0);
            return (
              <section key={level.id} aria-labelledby={`lvl-${level.id}`}>
                <div className="flex items-end justify-between gap-3">
                  <h2 id={`lvl-${level.id}`} className="font-display text-lg uppercase text-cream">
                    {level.title}
                    {testedOut(track.id, level.id, placements) && <span className="label-mono ml-2 align-middle text-[10px] text-sage-200">Tested out</span>}
                  </h2>
                  <span className="label-mono shrink-0 text-cream/50">{earned}/{level.sessions.length * 3} ★</span>
                </div>
                <p className="mt-1 text-sm text-cream/55">{level.blurb}</p>
                <ol className="mt-3 grid gap-2 landscape:grid-cols-2">
                  {level.sessions.map((s, i) => {
                    const stars = done?.[s.id] ?? 0;
                    const isNext = next?.id === s.id;
                    return (
                      <li key={s.id}>
                        <Link
                          href={`/path/session?id=${s.id}`}
                          className={`flex items-center gap-3 rounded-2xl border p-3 ${isNext ? "border-amber-400/70 bg-amber-400/10" : "border-cream/10"}`}
                        >
                          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${stars ? "bg-sage-300/20 text-sage-200" : isNext ? "bg-amber-400 text-ink-950" : "border border-cream/15 text-cream/50"}`}>
                            {isCheck(s.id) ? "◎" : stars ? "✓" : i + 1}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-semibold text-cream">{s.title}</span>
                            <span className="block truncate text-sm text-cream/55">{s.blurb}</span>
                          </span>
                          <Stars n={stars} />
                        </Link>
                      </li>
                    );
                  })}
                </ol>
              </section>
            );
          })}
        </div>
      </div>
    </main>
  );
}

function Stars({ n }: { n: number }) {
  return (
    <span className="shrink-0 text-amber-400" aria-label={`${n} of 3 stars`}>
      {[0, 1, 2].map((k) => (
        <span key={k} className={k < n ? "" : "text-cream/15"}>★</span>
      ))}
    </span>
  );
}
