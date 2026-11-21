"use client";

/**
 * While a song is being worked out: the real stages in plain words, a progress
 * bar that moves steadily (it eases towards the end and never claims to be done
 * early), a preview of what's coming, and a guitar tip to read meanwhile.
 */
import { useEffect, useState } from "react";

const STAGES = [
  { at: 0, label: "Finding the song", detail: "Key, tempo, time signature and the sections" },
  { at: 2.5, label: "Working out the chords", detail: "Every chord, the order of the sections, the strumming" },
  { at: 6, label: "Writing your lessons", detail: "A lesson for each section and the hardest changes" },
  { at: 11, label: "Checking shapes and charts", detail: "Fingerings, the chord chart and the play-along" },
];

const TIPS = [
  "Change chords on the last beat of the bar: the new chord then lands right on beat one.",
  "Slow and clean beats fast and messy. Speed comes from repeating it right.",
  "Keep your strumming hand moving even when you miss the strings: that's how you keep time.",
  "Press just behind the fret, not on top of it: less pressure, less buzz.",
  "If a chord is too hard for now, play its simpler version and keep the song going.",
];

export default function CouncilProgress({ active }: { active: boolean }) {
  const [elapsed, setElapsed] = useState(0);
  const [tip] = useState(() => TIPS[Math.floor(Math.random() * TIPS.length)]);

  useEffect(() => {
    if (!active) {
      setElapsed(0);
      return;
    }
    const start = performance.now();
    const t = setInterval(() => setElapsed((performance.now() - start) / 1000), 250);
    return () => clearInterval(t);
  }, [active]);

  if (!active) return null;
  const stage = STAGES.reduce((cur, s, i) => (elapsed >= s.at ? i : cur), 0);
  // eases towards 95% (a typical song takes 8–20 s); finishing jumps straight to the result
  const pct = Math.min(95, 100 * (1 - Math.exp(-elapsed / 9)));

  return (
    <div className="mx-auto mt-8 w-full max-w-3xl" role="status" aria-live="polite" aria-label={`${STAGES[stage].label}…`}>
      <div className="rounded-[22px] border border-cream/10 bg-ink-900/60 p-5 short:p-4">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-display text-lg uppercase text-cream">{STAGES[stage].label}…</p>
          <p className="label-mono text-cream/40 tabular-nums">{Math.floor(elapsed)} s</p>
        </div>
        <p className="mt-1 text-sm text-cream/60">{STAGES[stage].detail}</p>

        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-cream/10" aria-hidden="true">
          <div className="h-full rounded-full bg-amber-400 transition-[width] duration-300 ease-out" style={{ width: `${pct}%` }} />
        </div>

        <ol className="mt-4 grid gap-2 landscape:grid-cols-4">
          {STAGES.map((s, i) => (
            <li key={s.label} className="flex items-center gap-2 text-sm">
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] ${
                  i < stage ? "border-sage-300 bg-sage-300/20 text-sage-200" : i === stage ? "border-amber-400 text-amber-300" : "border-cream/15 text-cream/30"
                }`}
              >
                {i < stage ? "✓" : i + 1}
              </span>
              <span className={i <= stage ? "text-cream/85" : "text-cream/35"}>{s.label}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* what's coming: the shape of the result, so the wait has a destination */}
      <div className="mt-3 grid gap-3 landscape:grid-cols-[2fr_1fr]" aria-hidden="true">
        <div className="space-y-2 rounded-[22px] border border-cream/5 p-4">
          <div className="h-3 w-1/3 rounded bg-cream/10 skeleton" />
          <div className="h-3 w-5/6 rounded bg-cream/5 skeleton" />
          <div className="h-3 w-2/3 rounded bg-cream/5 skeleton" />
          <div className="mt-3 flex gap-2">
            {[0, 1, 2, 3].map((k) => (
              <div key={k} className="h-14 w-11 rounded-lg bg-cream/5 skeleton" />
            ))}
          </div>
        </div>
        <div className="rounded-[22px] border border-cream/5 p-4">
          <p className="label-mono text-[10px] text-amber-400">While you wait</p>
          <p className="mt-1 text-sm text-cream/70">{tip}</p>
        </div>
      </div>
    </div>
  );
}
