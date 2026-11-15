"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LEVELS, nextSession } from "@/lib/path/curriculum";
import { loadPathProgress } from "@/lib/path/progress";

/** The learning path: levels of short sessions, each ending in a song. */
export default function PathPage() {
  const [done, setDone] = useState<Record<string, number> | null>(null);
  useEffect(() => {
    loadPathProgress().then(setDone);
  }, []);
  const next = done ? nextSession(done) : null;

  return (
    <main className="min-h-[100dvh] bg-ink-950 px-4 pb-12 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <Link href="/studio" className="label-mono text-cream/50">← Studio</Link>
      <p className="label-mono mt-6 text-amber-400">Your path</p>
      <h1 className="mt-1 font-display text-h1 uppercase text-cream">Lessons</h1>
      <p className="mt-2 max-w-prose text-cream/65">Short sessions: learn it, play it for the app, practise it with a band, then play a song with it.</p>

      {next && (
        <Link href={`/path/session?id=${next.id}`} className="mt-6 flex items-center justify-between gap-4 rounded-[22px] bg-amber-400 px-5 py-4 text-ink-950">
          <span>
            <span className="label-mono block text-ink-950/60">Up next</span>
            <span className="mt-1 block font-display text-xl uppercase">{next.title}</span>
            <span className="mt-0.5 block text-sm text-ink-950/70">{next.blurb}</span>
          </span>
          <span className="text-3xl" aria-hidden="true">→</span>
        </Link>
      )}

      <div className="mt-8 space-y-8">
        {LEVELS.map((level) => {
          const earned = level.sessions.reduce((n, s) => n + (done?.[s.id] ?? 0), 0);
          return (
            <section key={level.id} aria-labelledby={`lvl-${level.id}`}>
              <div className="flex items-end justify-between gap-3">
                <h2 id={`lvl-${level.id}`} className="font-display text-xl uppercase text-cream">{level.title}</h2>
                <span className="label-mono text-cream/50">{earned}/{level.sessions.length * 3} ★</span>
              </div>
              <p className="mt-1 text-sm text-cream/55">{level.blurb}</p>
              <ol className="mt-3 space-y-2">
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
                          {stars ? "✓" : i + 1}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold text-cream">{s.title}</span>
                          <span className="block truncate text-sm text-cream/55">{s.blurb}</span>
                        </span>
                        <span className="shrink-0 text-amber-400" aria-label={`${stars} of 3 stars`}>
                          {[0, 1, 2].map((k) => (
                            <span key={k} className={k < stars ? "" : "text-cream/15"}>★</span>
                          ))}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            </section>
          );
        })}
      </div>
    </main>
  );
}
