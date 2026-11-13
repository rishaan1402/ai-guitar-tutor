"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import ChordDiagram from "@/components/ChordDiagram";
import { getFingering, type ChordFingering } from "@/lib/api";
import { toAppChordKey } from "@/lib/chordpro";

// Fingerings never change at runtime; share them across sheets
const fingeringCache = new Map<string, Promise<ChordFingering | null>>();

export function loadFingering(key: string): Promise<ChordFingering | null> {
  if (!fingeringCache.has(key)) {
    fingeringCache.set(key, getFingering(key).catch(() => null));
  }
  return fingeringCache.get(key)!;
}

interface Props {
  chords: string[];
  activeChord: string | null;
  onSelect: (chord: string) => void;
}

export default function ChordPanel({ chords, activeChord, onSelect }: Props) {
  const [fingerings, setFingerings] = useState<Record<string, ChordFingering | null>>({});
  const refs = useRef<Record<string, HTMLDivElement | null>>({});

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

  useEffect(() => {
    if (activeChord) refs.current[activeChord]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeChord]);

  const unsupported = chords.filter((c) => !toAppChordKey(c));

  return (
    <div>
      <h2 className="text-sm font-semibold text-white mb-3">Chords in this song</h2>
      <div className="flex flex-wrap gap-3">
        {chords.map((chord) => {
          const key = toAppChordKey(chord);
          const fingering = fingerings[chord];
          return (
            <div
              key={chord}
              ref={(el) => {
                refs.current[chord] = el;
              }}
              className={`flex flex-col items-center gap-1 rounded-xl p-1 transition-shadow ${
                chord === activeChord ? "ring-2 ring-violet-400" : ""
              }`}
            >
              <button type="button" onClick={() => onSelect(chord)} aria-label={`Show ${chord}`}>
                {fingering ? (
                  <ChordDiagram fingering={fingering} />
                ) : (
                  <div className="glass-card w-[88px] h-[132px] flex items-center justify-center text-sm font-semibold text-violet-300">
                    {chord}
                  </div>
                )}
              </button>
              {key && fingering ? (
                <Link
                  href={`/practice?chord=${encodeURIComponent(key)}`}
                  className="text-[11px] text-purple-300 hover:text-purple-200"
                >
                  Practice →
                </Link>
              ) : key && !(chord in fingerings) ? (
                <span className="text-[11px] text-gray-600" aria-hidden>…</span>
              ) : (
                <span className="text-[11px] text-gray-600">No lesson</span>
              )}
            </div>
          );
        })}
      </div>
      {unsupported.length > 0 && (
        <p className="text-xs text-gray-500 mt-3">
          {unsupported.join(", ")} {unsupported.length === 1 ? "has" : "have"} no lesson yet. Turn on{" "}
          <span className="text-gray-300">Simplify</span> to swap in chords you can practise here.
        </p>
      )}
    </div>
  );
}
