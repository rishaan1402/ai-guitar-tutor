"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { QuizStep } from "@/components/path/steps/Steps";
import { TRACKS } from "@/lib/path/curriculum";
import { probesFor, savePlacement } from "@/lib/path/placement";

export default function PlacementPage() {
  return (
    <Suspense fallback={null}>
      <Placement />
    </Suspense>
  );
}

/** Find your level: a short probe per level until one doesn't come easily. */
function Placement() {
  const router = useRouter();
  const trackId = useSearchParams().get("track") ?? TRACKS[0].id;
  const track = TRACKS.find((t) => t.id === trackId) ?? TRACKS[0];
  const probes = useMemo(() => probesFor(track.id), [track.id]);
  const [i, setI] = useState(-1); // -1 = intro
  const [result, setResult] = useState<number | null>(null); // index of the level to start at

  const pass = () => (i + 1 >= probes.length ? setResult(probes.length - 1) : setI(i + 1));
  const fail = () => setResult(i);
  const probe = i >= 0 && result === null ? probes[i] : null;

  const start = (idx: number) => {
    savePlacement(track.id, idx > 0 ? probes[idx].level.id : null);
    router.push(`/path?track=${track.id}`);
  };

  return (
    <main className="min-h-[100dvh] bg-ink-950 px-4 pb-10 pt-[max(1rem,var(--sa-t))] landscape:px-6">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center gap-3">
          <Link href="/path" aria-label="Back to lessons" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-cream/15 text-cream/80">←</Link>
          <div className="min-w-0 flex-1">
            <p className="label-mono text-amber-400">Find your level</p>
            <h1 className="truncate font-display text-xl uppercase text-cream">{track.title}</h1>
          </div>
          {probe && <span className="label-mono text-cream/60">Level {i + 1} / {probes.length}</span>}
        </div>

        <div className="mt-5">
          {i < 0 && result === null && (
            <div className="space-y-4 rounded-[22px] border border-cream/10 p-5">
              <p className="text-[15px] text-cream/85">
                Already play? Answer a few quick questions from each level of <strong className="text-cream">{track.title}</strong>. When a level doesn&apos;t come easily,
                that&apos;s where you start. Nothing gets locked or skipped for good: every lesson stays open, and you can retake this anytime.
              </p>
              <div className="flex flex-wrap gap-2">
                {TRACKS.map((t) => (
                  <Link key={t.id} href={`/path/placement?track=${t.id}`} className={`rounded-full border px-3 py-1.5 text-sm ${t.id === track.id ? "border-amber-400 text-amber-100" : "border-cream/15 text-cream/70"}`}>
                    {t.title}
                  </Link>
                ))}
              </div>
              <button onClick={() => setI(0)} className="h-12 w-full rounded-full bg-amber-400 font-semibold text-ink-950">Start</button>
            </div>
          )}

          {probe && (
            <div className="space-y-3" key={probe.level.id}>
              <div>
                <p className="font-display text-lg uppercase text-cream">{probe.level.title}</p>
                <p className="text-sm text-cream/60">{probe.level.blurb}</p>
              </div>
              {probe.questions.length ? (
                <QuizStep
                  step={{ kind: "quiz", title: "Quick check", questions: probe.questions }}
                  onDone={(stars) => ((stars ?? 0) >= 1 ? pass() : fail())}
                />
              ) : (
                <div className="space-y-3 rounded-[22px] border border-cream/10 p-5">
                  <p className="text-[15px] text-cream/85">Can you already do this comfortably?</p>
                  <div className="flex gap-2">
                    <button onClick={pass} className="h-12 flex-1 rounded-full bg-amber-400 font-semibold text-ink-950">Yes, I can</button>
                    <button onClick={fail} className="h-12 flex-1 rounded-full border border-cream/15 text-cream/85">Not yet</button>
                  </div>
                </div>
              )}
              <button onClick={fail} className="w-full text-center text-sm text-cream/60 underline-offset-4 hover:underline">Start me here</button>
            </div>
          )}

          {result !== null && (
            <div className="space-y-4 rounded-[22px] border border-cream/10 p-5 text-center">
              <p className="label-mono text-amber-400">Your starting point</p>
              <p className="font-display text-2xl uppercase text-cream">{probes[result].level.title}</p>
              <p className="text-cream/70">
                {result === 0
                  ? "Start from the beginning: it moves quickly when things are easy."
                  : `${result} level${result > 1 ? "s" : ""} before it ${result > 1 ? "are" : "is"} marked as tested out. They stay open if you want to go back.`}
              </p>
              <button onClick={() => start(result)} className="h-12 w-full rounded-full bg-amber-400 font-semibold text-ink-950">Start here →</button>
              <button onClick={() => { setResult(null); setI(-1); }} className="h-11 w-full rounded-full border border-cream/15 text-cream/70">Take it again</button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
