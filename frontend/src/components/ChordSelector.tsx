"use client";

import { useEffect, useState } from "react";
import { listChords } from "@/lib/api";
import { BEGINNER_PATH, chordSymbol, formatChord } from "@/lib/chordName";
import { pluck } from "@/lib/sound";

interface Props {
  onSelect: (chord: string) => void;
  disabled?: boolean;
  chordStatuses?: Record<string, "not_attempted" | "in_progress" | "mastered">;
}

const ROOTS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const QUALITIES: { key: string; label: string }[] = [
  { key: "major", label: "Major" },
  { key: "minor", label: "Minor" },
  { key: "dominant7", label: "7" },
  { key: "major7", label: "maj7" },
  { key: "minor7", label: "m7" },
  { key: "half_dim7", label: "m7♭5" },
  { key: "power", label: "5" },
];
// open-string pitch for a little pluck on hover
const ROOT_HZ: Record<string, number> = { C: 130.81, "C#": 138.59, D: 146.83, "D#": 155.56, E: 82.41, F: 87.31, "F#": 92.5, G: 98.0, "G#": 103.83, A: 110.0, "A#": 116.54, B: 123.47 };

function StatusDot({ status }: { status?: string }) {
  if (status === "mastered") return <span className="text-sage-300" aria-label="mastered">★</span>;
  if (status === "in_progress") return <span className="h-1.5 w-1.5 rounded-full bg-amber-400" aria-label="in progress" />;
  return null;
}

/**
 * Choosing a chord: the beginner path first (one click to start), then every
 * chord in a root × quality grid.
 */
export default function ChordSelector({ onSelect, disabled, chordStatuses = {} }: Props) {
  const [chords, setChords] = useState<Set<string> | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    listChords()
      .then((data) => setChords(new Set(data.chords)))
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <p className="text-amp-300">Couldn&apos;t load chords: {error}</p>;

  const path = BEGINNER_PATH.filter((c) => !chords || chords.has(c));
  const nextIdx = path.findIndex((c) => chordStatuses[c] !== "mastered");

  return (
    <div className="space-y-8">
      <section aria-labelledby="path-title">
        <div className="flex items-baseline justify-between gap-3">
          <h3 id="path-title" className="label-mono text-amber-300">Start here — the first eight</h3>
          <span className="label-mono text-cream/40">one click to start</span>
        </div>
        <ol className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-8">
          {path.map((c, i) => {
            const status = chordStatuses[c];
            const isNext = i === nextIdx;
            return (
              <li key={c}>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onSelect(c)}
                  onPointerEnter={(e) => e.pointerType === "mouse" && pluck(ROOT_HZ[c.split("_")[0]] ?? 110)}
                  aria-label={`${formatChord(c)}${isNext ? " — next up" : ""}${status === "mastered" ? " — mastered" : ""}`}
                  className={`group relative flex h-20 w-full flex-col items-center justify-center rounded-2xl border transition-all duration-fast disabled:opacity-50 ${
                    isNext
                      ? "border-amber-400 bg-amber-400/10 shadow-[0_0_30px_-8px_rgba(232,165,75,0.6)]"
                      : status === "mastered"
                        ? "border-sage-400/40 bg-sage-400/5"
                        : "border-cream/10 hover:border-cream/30"
                  }`}
                >
                  <span className="label-mono absolute left-2 top-1.5 text-[10px] text-cream/35">{i + 1}</span>
                  <span className="font-display text-2xl text-cream group-hover:text-amber-200">{chordSymbol(c)}</span>
                  <span className="mt-1 flex h-3 items-center gap-1">
                    {isNext ? <span className="label-mono text-[9px] text-amber-300">Next</span> : <StatusDot status={status} />}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-labelledby="all-title">
        <h3 id="all-title" className="label-mono text-cream/50">Every chord</h3>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-cream/10">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr>
                <th scope="col" className="label-mono w-12 p-2 text-left text-cream/35">
                  <span className="sr-only">Root</span>
                </th>
                {QUALITIES.map((q) => (
                  <th key={q.key} scope="col" className="label-mono p-2 text-cream/45">
                    {q.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROOTS.map((r) => (
                <tr key={r} className="border-t border-cream/5">
                  <th scope="row" className="p-2 text-left font-display text-cream/70">
                    {r}
                  </th>
                  {QUALITIES.map((q) => {
                    const key = `${r}_${q.key}`;
                    const exists = !chords || chords.has(key);
                    const status = chordStatuses[key];
                    return (
                      <td key={q.key} className="p-1 text-center">
                        {exists ? (
                          <button
                            type="button"
                            disabled={disabled || !chords}
                            onClick={() => onSelect(key)}
                            aria-label={formatChord(key)}
                            className={`inline-flex h-9 w-full min-w-[3.5rem] items-center justify-center gap-1 rounded-lg font-mono text-sm transition-colors duration-fast disabled:opacity-40 ${
                              status === "mastered"
                                ? "bg-sage-400/10 text-sage-200 hover:bg-sage-400/20"
                                : "text-cream/80 hover:bg-amber-400/10 hover:text-amber-200"
                            }`}
                          >
                            {chordSymbol(key)}
                            <StatusDot status={status} />
                          </button>
                        ) : (
                          <span className="text-cream/15">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
