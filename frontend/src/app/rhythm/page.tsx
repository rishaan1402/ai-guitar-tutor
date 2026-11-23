"use client";

/**
 * Strum trainer: any strumming pattern against a click. The mic hears each
 * strum (or you tap), every hit is marked on time / early / late / missed,
 * and a clean run moves the tempo up 5 bpm. Song lessons link here with the
 * song's own strum (?p=D%20DU%20UDU&bpm=72).
 */
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import NavBar from "@/components/NavBar";
import { RhythmStep } from "@/components/path/steps/Steps";
import { strumPattern } from "@/lib/path/rhythm";

const PRESETS: { name: string; strum: string; bpm: number; hint: string }[] = [
  { name: "All downs", strum: "D D D D", bpm: 70, hint: "One down-strum on every beat." },
  { name: "Down-ups", strum: "DUDUDUDU", bpm: 66, hint: "Eighth notes: the hand never stops." },
  { name: "Campfire", strum: "D DU UDU", bpm: 72, hint: "The pattern behind half of all pop songs." },
  { name: "Offbeat", strum: " U U U U", bpm: 76, hint: "Reggae and ska: only the &s." },
  { name: "Funk 16ths", strum: "DUDUDUDUDUDUDUDU", bpm: 60, hint: "Sixteenths: small, fast wrist." },
];
const MIN_BPM = 40;
const MAX_BPM = 180;

function Trainer() {
  const params = useSearchParams();
  const [strum, setStrum] = useState(PRESETS[2].strum);
  const [typed, setTyped] = useState(PRESETS[2].strum);
  const [bpm, setBpm] = useState(PRESETS[2].bpm);
  const [input, setInput] = useState<"strum" | "tap">("strum");
  const [run, setRun] = useState(0);
  const [note, setNote] = useState<string | null>(null);

  // a song lesson's strum, if we were sent one
  useEffect(() => {
    const p = params.get("p");
    const b = Number(params.get("bpm"));
    if (p && strumPattern(p)) {
      setStrum(p);
      setTyped(p);
    }
    if (b >= MIN_BPM && b <= MAX_BPM) setBpm(Math.round(b));
  }, [params]);

  const parsed = strumPattern(strum);
  const typedOk = strumPattern(typed) !== null;
  const restart = () => (setRun((r) => r + 1), setNote(null));

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:py-10">
      <header>
        <p className="label-mono text-amber-300">Play</p>
        <h1 className="mt-2 font-display text-h1 uppercase text-cream">Strum trainer</h1>
        <p className="mt-3 max-w-xl text-cream/75">
          Pick a pattern, play it with the click, and see every hit: on time, early, late or missed. A clean run moves the
          tempo up.
        </p>
      </header>

      <section aria-labelledby="pattern-h" className="space-y-3">
        <h2 id="pattern-h" className="label-mono text-amber-300">Pattern</h2>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.name}
              type="button"
              onClick={() => (setStrum(p.strum), setTyped(p.strum), setBpm(p.bpm), restart())}
              aria-pressed={strum === p.strum}
              title={p.hint}
              className={`rounded-full border px-4 py-2 text-sm ${strum === p.strum ? "border-amber-400 bg-amber-400/15 text-amber-100" : "border-cream/15 text-cream/80"}`}
            >
              {p.name}
            </button>
          ))}
        </div>
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (typedOk) (setStrum(typed), restart());
          }}
        >
          <label htmlFor="strum-input" className="text-sm text-cream/70">Your own:</label>
          <input
            id="strum-input"
            value={typed}
            onChange={(e) => setTyped(e.target.value.toUpperCase())}
            maxLength={16}
            spellCheck={false}
            className="h-10 w-48 rounded-full border border-cream/15 bg-transparent px-4 font-mono tracking-[0.3em] text-cream"
            aria-describedby="strum-help"
          />
          <button disabled={!typedOk} className="h-10 rounded-full border border-amber-400/50 px-4 text-sm font-semibold text-amber-100 disabled:opacity-40">Use it</button>
          <p id="strum-help" className="w-full text-xs text-cream/60">D = down, U = up, space = hand moves but misses the strings. 4, 8 or 16 slots a bar.</p>
        </form>
      </section>

      <section aria-labelledby="tempo-h" className="flex flex-wrap items-center gap-4">
        <h2 id="tempo-h" className="sr-only">Tempo and input</h2>
        <label htmlFor="bpm" className="label-mono text-cream/70">Tempo</label>
        <input id="bpm" type="range" min={MIN_BPM} max={MAX_BPM} step={1} value={bpm} onChange={(e) => (setBpm(Number(e.target.value)), restart())} className="min-w-0 flex-1 basis-40 accent-amber-400" />
        <span className="w-20 text-right text-cream">{bpm} bpm</span>
        <div className="flex gap-1 rounded-full border border-cream/10 p-1" role="group" aria-label="How you play">
          {(["strum", "tap"] as const).map((m) => (
            <button key={m} type="button" aria-pressed={input === m} onClick={() => (setInput(m), restart())} className={`rounded-full px-3 py-1 text-sm ${input === m ? "bg-amber-400/15 text-amber-100" : "text-cream/70"}`}>
              {m === "strum" ? "Guitar (mic)" : "Tap"}
            </button>
          ))}
        </div>
      </section>

      {note && <p role="status" className="rounded-2xl border border-sage-300/40 bg-sage-300/10 px-4 py-2 text-sm text-sage-100">{note}</p>}

      {parsed && (
        <div className="rounded-[26px] border border-cream/10 bg-ink-900/60 p-4 sm:p-5">
          <RhythmStep
            key={`${strum}|${bpm}|${input}|${run}`}
            step={{
              kind: "rhythm",
              title: `${strum.trim()} · ${bpm} bpm`,
              prompt: input === "strum" ? "Strum on the arrows: **↓** down, **↑** up. Keep your hand moving on the empty slots." : "Tap on the arrows (or press space).",
              pattern: parsed.pattern,
              strokes: parsed.strokes,
              bpm,
              bars: 2,
              input: input === "strum" ? "strum" : "tap",
            }}
            continueLabel={`Next: ${Math.min(MAX_BPM, bpm + 5)} bpm →`}
            onDone={(got) => {
              const stars = got ?? 0;
              if (stars >= 2 && bpm < MAX_BPM) {
                setBpm((b) => Math.min(MAX_BPM, b + 5));
                setNote(`Clean enough: up to ${Math.min(MAX_BPM, bpm + 5)} bpm.`);
              } else {
                setNote(stars >= 2 ? "Top speed. Nice." : "Not quite clean yet: same tempo again.");
              }
              setRun((r) => r + 1);
            }}
          />
        </div>
      )}
    </div>
  );
}

export default function RhythmPage() {
  return (
    <main className="min-h-screen bg-ink-950">
      <NavBar />
      <Suspense fallback={<div className="mx-auto max-w-3xl px-4 py-10"><h1 className="font-display text-h1 uppercase text-cream">Strum trainer</h1></div>}>
        <Trainer />
      </Suspense>
    </main>
  );
}
