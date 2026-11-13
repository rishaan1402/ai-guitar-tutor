"use client";

import { useEffect, useState } from "react";

/**
 * Shows the four honest verdicts the grader gives, cycling through takes:
 * strings light up for what it heard, then the verdict card explains.
 */
const TAKES = [
  {
    chord: "C major",
    heard: [false, true, true, true, true, true], // low E muted
    state: ["mute", "ok", "ok", "ok", "ok", "ok"],
    tag: "Pass",
    tone: "sage",
    title: "Clean take",
    body: "Every string in the chord rang. That's clean day 1 of 3.",
  },
  {
    chord: "C major",
    heard: [false, true, true, true, false, true],
    state: ["mute", "ok", "ok", "ok", "miss", "ok"],
    tag: "Fix one string",
    tone: "amp",
    title: "B string is muted",
    body: "Check finger 1 on string 2, fret 1 (C) — press just behind the fret.",
  },
  {
    chord: "A major",
    heard: [false, true, true, true, true, true],
    state: ["mute", "ok", "ok", "ok", "unsure", "ok"],
    tag: "Strum again",
    tone: "cream",
    title: "Not sure — let it ring",
    body: "I couldn't hear every string clearly. Listen for the C#. No penalty.",
  },
  {
    chord: "C major",
    heard: [true, true, true, true, true, true],
    state: ["ok", "ok", "ok", "ok", "ok", "ok"],
    tag: "Tune down",
    tone: "amber",
    title: "Right shape, sharp guitar",
    body: "Your guitar is about 56 cents sharp. Tune down and strum it again.",
  },
] as const;

const NAMES = ["E", "A", "D", "G", "B", "e"];
const TONE: Record<string, string> = {
  sage: "border-sage-400/50 bg-sage-400/10 text-sage-200",
  amp: "border-amp-400/60 bg-amp-500/10 text-amp-300",
  cream: "border-cream/30 bg-cream/5 text-cream",
  amber: "border-amber-400/60 bg-amber-400/10 text-amber-200",
};
const STRING: Record<string, string> = {
  ok: "bg-sage-300 shadow-[0_0_14px_rgba(163,198,171,0.8)]",
  miss: "bg-amp-400 shadow-[0_0_14px_rgba(232,96,79,0.9)] animate-pulse",
  unsure: "bg-amber-300/70 shadow-[0_0_10px_rgba(232,165,75,0.6)]",
  mute: "bg-cream/15",
};

export default function VerdictDemo() {
  const [i, setI] = useState(0);
  const [lit, setLit] = useState(0);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setLit(6);
      return;
    }
    setLit(0);
    const strum = window.setInterval(() => setLit((n) => (n >= 6 ? 6 : n + 1)), 70);
    const next = window.setTimeout(() => setI((x) => (x + 1) % TAKES.length), 4200);
    return () => {
      clearInterval(strum);
      clearTimeout(next);
    };
  }, [i]);

  const t = TAKES[i];
  return (
    <div className="grid gap-6 rounded-[28px] border border-cream/10 bg-ink-900/70 p-6 sm:p-8 md:grid-cols-[1.1fr_1fr]">
      <div>
        <p className="label-mono text-cream/50">Listening for {t.chord}</p>
        <div className="mt-5 space-y-3" aria-hidden="true">
          {NAMES.map((n, s) => (
            <div key={n + s} className="flex items-center gap-3">
              <span className="label-mono w-4 text-cream/40">{n}</span>
              <div className="relative h-[3px] flex-1 overflow-hidden rounded-full bg-cream/10">
                <div
                  className={`absolute inset-0 rounded-full transition-all duration-base ease-out-expo ${STRING[t.state[s]]} ${
                    s < lit ? "opacity-100" : "opacity-0"
                  }`}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-col justify-center" aria-live="polite">
        <span className={`label-mono inline-flex w-fit rounded-full border px-3 py-1 ${TONE[t.tone]}`}>{t.tag}</span>
        <p className="mt-3 font-display text-2xl uppercase leading-tight text-cream">{t.title}</p>
        <p className="mt-2 text-cream/70">{t.body}</p>
        <div className="mt-5 flex gap-1.5" role="tablist" aria-label="Example verdicts">
          {TAKES.map((x, k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={k === i}
              aria-label={x.tag}
              onClick={() => setI(k)}
              className={`h-1.5 rounded-full transition-all duration-base ${k === i ? "w-8 bg-amber-400" : "w-3 bg-cream/20 hover:bg-cream/40"}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
