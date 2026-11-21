"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { AppMenu } from "@/components/NavBar";
import { useRouter, useSearchParams } from "next/navigation";
import GroovePlayer from "@/components/groove/GroovePlayer";
import { PRESET_GROOVES, presetById } from "@/lib/groove/groove";
import { decodeGroove, encodeGroove, type GrooveWithSource } from "@/lib/groove/link";
import { LEAD_RIFFS } from "@/lib/groove/lead";
import { generateGroove } from "@/lib/api";
import { prettySymbol } from "@/lib/chordShape";

/**
 * /groove                      the jam corner (Today's Groove, make one, starters)
 * /groove?id=late-night-g      a starter Groove
 * /groove?g=...                a Groove carried in the link (AI, song section, Fix it)
 * /groove?daily=1              Today's Groove, built for you
 * /groove?ai=1&focus=G,C&style=folk   a Groove built for you around a change
 */
export default function GroovePage() {
  return (
    <Suspense fallback={null}>
      <GrooveRoute />
    </Suspense>
  );
}

function GrooveRoute() {
  const params = useSearchParams();
  const router = useRouter();
  const preset = presetById(params.get("id"), LEAD_RIFFS);
  const linked = decodeGroove(params.get("g"));
  const daily = params.get("daily") === "1";
  const ai = params.get("ai") === "1";
  const [error, setError] = useState<string | null>(null);

  // build one, then put it in the URL so reloads and back keep the same Groove
  useEffect(() => {
    if (!(daily || ai) || linked || preset) return;
    let live = true;
    const focus = params.get("focus")?.split(",").slice(0, 2);
    generateGroove({
      daily,
      focus: focus?.length === 2 ? (focus as [string, string]) : undefined,
      style: params.get("style") ?? undefined,
      faster: params.get("faster") === "1",
    })
      .then((g) => {
        if (!live) return;
        const withSource: GrooveWithSource = { ...g, focus: g.focus ?? undefined, tip: g.tip ?? undefined };
        router.replace(`/groove?g=${encodeGroove(withSource)}`);
      })
      .catch(() => live && setError("Couldn't build your Groove. Check your connection and try again."));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [daily, ai]);

  if (preset) return <GroovePlayer key={preset.id} groove={{ ...preset, source: preset.kind === "lead" ? "lead" : "preset" }} />;
  if (linked) return <GroovePlayer key={params.get("g") ?? ""} groove={linked} defaultMode={linked.mode} />;
  if (daily || ai) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-ink-950 p-6 text-center">
        {error ? (
          <>
            <p className="text-cream/80">{error}</p>
            <Link href="/groove" className="rounded-full border border-cream/20 px-5 py-2.5 text-cream">Back to Grooves</Link>
          </>
        ) : (
          <>
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
            <p className="label-mono text-cream/60">Building a Groove for you…</p>
            <p className="max-w-xs text-sm text-cream/45">Picking the change you most need, in chords you know, at a tempo that fits.</p>
          </>
        )}
      </div>
    );
  }
  return <JamCorner />;
}

const STYLE_CHIPS = [
  { id: "", label: "Surprise me" },
  { id: "pop", label: "Pop" },
  { id: "folk", label: "Folk" },
  { id: "ballad", label: "Ballad" },
  { id: "rock", label: "Rock" },
];

function JamCorner() {
  const [style, setStyle] = useState("");
  return (
    <main className="min-h-[100dvh] bg-ink-950 px-4 pb-10 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <div className="flex items-center justify-between">
        <Link href="/studio" className="label-mono text-cream/50">← Studio</Link>
        <AppMenu />
      </div>
      <p className="label-mono mt-6 text-amber-400">Jam corner</p>
      <h1 className="mt-1 font-display text-h1 uppercase text-cream">Grooves</h1>
      <p className="mt-2 max-w-prose text-cream/65">
        Short loops with a backing band, played on the highway. Each one is built around a chord change, and the music waits for
        you, follows you, or keeps time and scores you.
      </p>

      <Link href="/groove?daily=1" className="mt-6 flex items-center justify-between gap-4 rounded-[22px] bg-amber-400 px-5 py-4 text-ink-950">
        <span>
          <span className="label-mono block text-ink-950/60">Built for you</span>
          <span className="mt-1 block font-display text-xl uppercase">Today&apos;s Groove</span>
          <span className="mt-0.5 block text-sm text-ink-950/70">Your slowest change, in chords you know.</span>
        </span>
        <span className="text-3xl" aria-hidden="true">→</span>
      </Link>

      <div className="mt-4 rounded-[22px] border border-cream/10 p-4">
        <p className="font-semibold text-cream">Make me a Groove</p>
        <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Style">
          {STYLE_CHIPS.map((c) => (
            <button
              key={c.id}
              role="radio"
              aria-checked={style === c.id}
              onClick={() => setStyle(c.id)}
              className={`rounded-full border px-3 py-1.5 text-sm ${style === c.id ? "border-amber-400 bg-amber-400/15 text-amber-100" : "border-cream/15 text-cream/75"}`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <Link href={`/groove?ai=1${style ? `&style=${style}` : ""}`} className="mt-3 inline-flex h-11 items-center rounded-full border border-amber-400/60 px-5 text-amber-100">
          Build it →
        </Link>
      </div>

      <p className="label-mono mt-8 text-cream/50">Riffs & melodies (single notes)</p>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2">
        {LEAD_RIFFS.map((g) => (
          <li key={g.id}>
            <Link href={`/groove?id=${g.id}`} className="block rounded-2xl border border-cream/10 p-4 hover:border-amber-400/50">
              <span className="label-mono text-amber-400">lead · {g.bpm} bpm</span>
              <span className="mt-1 block font-display text-xl uppercase text-cream">{g.title}</span>
              <span className="mt-1 block text-sm text-cream/60">{g.tip}</span>
            </Link>
          </li>
        ))}
      </ul>

      <p className="label-mono mt-8 text-cream/50">Chord starters</p>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2">
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
