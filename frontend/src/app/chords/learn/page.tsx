"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { AppMenu } from "@/components/NavBar";
import { useRouter, useSearchParams } from "next/navigation";
import ChordLesson from "@/components/chords/ChordLesson";
import ChordCheck from "@/components/path/ChordCheck";
import ChordTips from "@/components/chords/ChordTips";
import BuiltChordTake from "@/components/chords/BuiltChordTake";
import { shapeFor, type ChordShape } from "@/lib/chords/shape";
import { describe, parseSymbol } from "@/lib/chords/quality";

export default function LearnChordPage() {
  return (
    <Suspense fallback={null}>
      <LearnChord />
    </Suspense>
  );
}

/** Learn any chord: an animated lesson built for it, then play it for the app. */
function LearnChord() {
  const params = useSearchParams();
  const router = useRouter();
  const symbol = (params.get("c") ?? "").trim().slice(0, 16);
  const [shape, setShape] = useState<ChordShape | null | undefined>(undefined);
  const [typed, setTyped] = useState(symbol);
  const [checked, setChecked] = useState(false);
  const spec = symbol ? parseSymbol(symbol) : null;

  useEffect(() => {
    setChecked(false);
    setTyped(symbol);
    if (!symbol) return setShape(null);
    setShape(undefined);
    shapeFor(symbol).then(setShape).catch(() => setShape(null));
  }, [symbol]);

  const go = (e: React.FormEvent) => {
    e.preventDefault();
    const s = typed.trim();
    if (s) router.replace(`/chords/learn?c=${encodeURIComponent(s)}`);
  };

  return (
    <main className="min-h-[100dvh] bg-ink-950 px-4 pb-10 pt-[max(1rem,var(--sa-t))] landscape:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/practice" aria-label="All chords" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-cream/15 text-cream/80">←</Link>
          <div className="min-w-0 flex-1">
            <p className="label-mono text-amber-400">Chords</p>
            <h1 className="truncate font-display text-xl uppercase text-cream">{symbol ? `Learn ${symbol}` : "Learn any chord"}</h1>
          </div>
          <AppMenu className="landscape:order-last" />
          <form onSubmit={go} className="flex w-full gap-2 landscape:w-auto" role="search" aria-label="Another chord">
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="Another chord, e.g. Cadd9"
              aria-label="Chord name"
              maxLength={16}
              className="h-10 min-w-0 flex-1 rounded-full border border-cream/15 bg-transparent px-4 text-cream placeholder:text-cream/40 landscape:w-48 landscape:flex-none"
            />
            <button className="h-10 shrink-0 rounded-full border border-amber-400/50 px-4 text-sm font-semibold text-amber-100">Learn it</button>
          </form>
        </div>

        <div className="mt-5 space-y-5">
          {shape === undefined && <p className="text-cream/60">Building {symbol}…</p>}
          {shape === null && (
            <div className="rounded-[22px] border border-cream/10 p-5">
              <p className="text-cream">{symbol ? `"${symbol}" isn't a chord name we can read.` : "Type a chord name to build its lesson."}</p>
              <p className="mt-2 text-sm text-cream/60">Try names like C, Am7, Dsus4, Cadd9, F#m7b5, G/B or E7#9.</p>
            </div>
          )}
          {shape && (
            <>
              <ChordLesson symbol={symbol} fingering={shape.fingering} autoPlay />
              <ChordTips symbol={symbol} fingering={shape.fingering} />
              {spec && (
                <p className="text-sm text-cream/60">
                  {describe(spec)}: {spec.noteNames.join(", ")}.{" "}
                  {shape.key && (
                    <Link href={`/practice?chord=${encodeURIComponent(shape.key)}`} className="text-amber-300 underline-offset-4 hover:underline">
                      This chord also has a full video lesson with per-string feedback →
                    </Link>
                  )}
                </p>
              )}
              <div className="mx-auto max-w-xl">
                {checked ? (
                  <p className="rounded-[22px] border border-sage-300/40 bg-sage-300/10 p-4 text-center text-sage-100">Nice, that&apos;s {symbol}. It&apos;s yours.</p>
                ) : (
                  <ChordCheck chord={symbol} onPass={() => setChecked(true)} />
                )}
              </div>
              <BuiltChordTake symbol={symbol} fingering={shape.fingering} libraryKey={shape.key} />
            </>
          )}
        </div>
      </div>
    </main>
  );
}
