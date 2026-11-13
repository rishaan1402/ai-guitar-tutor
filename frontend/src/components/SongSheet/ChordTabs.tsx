"use client";

import { useEffect, useState } from "react";
import type { ChordFingering } from "@/lib/api";
import { chordTab, type TabPattern } from "@/lib/chordTab";
import { toAppChordKey } from "@/lib/chordpro";
import { loadFingering } from "./ChordPanel";

const PATTERNS: { key: TabPattern; label: string }[] = [
  { key: "strum", label: "Strum" },
  { key: "arpeggio", label: "Picking" },
  { key: "travis", label: "Travis" },
];

interface Props {
  /** Chords as currently displayed (after transpose / capo / simplify). */
  chords: string[];
  fontSize?: number;
}

/** Strum / picking tabs for every chord on the sheet, generated from the app's fingerings. */
export default function ChordTabs({ chords, fontSize = 14 }: Props) {
  const [pattern, setPattern] = useState<TabPattern>("arpeggio");
  const [fingerings, setFingerings] = useState<Record<string, ChordFingering | null>>({});

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      chords.map(async (c) => {
        const key = toAppChordKey(c);
        return [c, key ? await loadFingering(key) : null] as const;
      }),
    ).then((pairs) => {
      if (!cancelled) setFingerings(Object.fromEntries(pairs));
    });
    return () => {
      cancelled = true;
    };
  }, [chords]);

  return (
    <section aria-labelledby="chord-tabs-heading" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="chord-tabs-heading" className="text-sm uppercase tracking-wider text-gray-400 font-semibold">
          Tabs
        </h2>
        <div role="radiogroup" aria-label="Tab pattern" className="flex gap-1">
          {PATTERNS.map((p) => (
            <button
              key={p.key}
              type="button"
              role="radio"
              aria-checked={pattern === p.key}
              onClick={() => setPattern(p.key)}
              className={`h-8 px-3 rounded-lg border text-sm ${
                pattern === p.key ? "border-amber-400/60 bg-amber-400/10 text-amber-200" : "border-white/10 text-gray-300 hover:bg-white/5"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <p className="text-xs text-gray-500">
        Patterns built from each chord&apos;s shape — they follow transpose, capo and simplify.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {chords.map((c) => {
          const f = fingerings[c];
          return (
            <figure key={c} className="rounded-lg bg-black/30 p-3 overflow-x-auto">
              <figcaption className="text-sm font-semibold text-gray-200 mb-1.5">{c}</figcaption>
              {f && f.positions?.length ? (
                <pre
                  className="font-mono leading-tight text-gray-300"
                  style={{ fontSize }}
                  aria-label={`${c} ${pattern} tab`}
                >
                  {chordTab(f.positions, pattern).join("\n")}
                </pre>
              ) : (
                <p className="text-xs text-gray-500">{f === undefined ? "Loading…" : "No fingering for this chord yet."}</p>
              )}
            </figure>
          );
        })}
      </div>
    </section>
  );
}
