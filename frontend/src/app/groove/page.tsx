"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import GroovePlayer from "@/components/groove/GroovePlayer";
import { PRESET_GROOVES, presetById } from "@/lib/groove/groove";
import { prettySymbol } from "@/lib/chordShape";

/** /groove?id=late-night-g plays one; /groove lists them (the jam corner). */
export default function GroovePage() {
  return (
    <Suspense fallback={null}>
      <GrooveRoute />
    </Suspense>
  );
}

function GrooveRoute() {
  const groove = presetById(useSearchParams().get("id"));
  if (groove) return <GroovePlayer groove={groove} />;
  return (
    <main className="min-h-[100dvh] bg-ink-950 px-4 pb-10 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <Link href="/studio" className="label-mono text-cream/50">← Studio</Link>
      <p className="label-mono mt-6 text-amber-400">Jam corner</p>
      <h1 className="mt-1 font-display text-h1 uppercase text-cream">Grooves</h1>
      <p className="mt-2 max-w-prose text-cream/65">Short loops with a backing band. Play along on the highway: the music waits for your chord changes, or keeps time and scores them.</p>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {PRESET_GROOVES.map((g) => (
          <li key={g.id}>
            <Link href={`/groove?id=${g.id}`} className="block rounded-2xl border border-cream/10 p-4 hover:border-amber-400/50">
              <span className="label-mono text-amber-400">{g.style} · {g.bpm} bpm</span>
              <span className="mt-1 block font-display text-xl uppercase text-cream">{g.title}</span>
              <span className="mt-1 block font-mono text-sm text-cream/60">{g.bars.map((b) => b.map(prettySymbol).join(" ")).join(" | ")}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
