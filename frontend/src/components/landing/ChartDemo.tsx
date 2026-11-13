"use client";

import { useEffect, useMemo, useState } from "react";
import { displayChord, mapChords, parseChordPro, chordsInSheet, type DisplayOptions, type Line } from "@/lib/chordpro";
import { chordTab } from "@/lib/chordTab";
import { toAppChordKey } from "@/lib/chordpro";
import { loadFingering } from "@/components/SongSheet/ChordPanel";
import type { ChordFingering } from "@/lib/api";
import { pluck } from "@/lib/sound";

// A generic progression (not a real song) in the same format the AI chart uses.
const DEMO = `{title: Late Night Practice}
{key: G}
{capo: 2}
{start_of_grid: Verse}
| G . . . | Em . . . | Cadd9 . . . | D . . . |
{end_of_grid}
{start_of_grid: Chorus}
| C . . . | G/B . . . | Am7 . . . | D . . . |
{end_of_grid}`;

/** Live mini chart: transpose, capo and simplify actually work, and a tab follows the chord you pick. */
export default function ChartDemo() {
  const sheet = useMemo(() => parseChordPro(DEMO), []);
  const [opts, setOpts] = useState<DisplayOptions>({ transpose: 0, capo: 2, flats: false, simplify: false });
  const shown = useMemo(() => mapChords(sheet, (c) => displayChord(c, sheet.meta, opts)), [sheet, opts]);
  const chords = useMemo(() => chordsInSheet(shown), [shown]);
  const [pick, setPick] = useState(0);
  const chord = chords[Math.min(pick, chords.length - 1)];
  const [fing, setFing] = useState<ChordFingering | null | undefined>(undefined);

  useEffect(() => {
    let off = false;
    const key = toAppChordKey(chord);
    setFing(undefined);
    (key ? loadFingering(key) : Promise.resolve(null)).then((f) => !off && setFing(f));
    return () => {
      off = true;
    };
  }, [chord]);

  const key = displayChord(sheet.meta.key ?? "G", sheet.meta, { ...opts, capo: sheet.meta.capo, simplify: false });
  const btn = "h-9 min-w-9 rounded-full border border-cream/15 px-3 text-sm text-cream hover:border-amber-400/60 hover:text-amber-200";

  return (
    <div className="grid gap-6 rounded-[28px] border border-cream/10 bg-ink-900/70 p-6 sm:p-8 lg:grid-cols-[1.3fr_1fr]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="label-mono mr-1 text-cream/50">Key {key}</span>
          <button type="button" className={btn} aria-label="Transpose down" onClick={() => setOpts((o) => ({ ...o, transpose: o.transpose - 1 }))}>−</button>
          <span className="label-mono text-cream/70">Transpose {opts.transpose > 0 ? `+${opts.transpose}` : opts.transpose}</span>
          <button type="button" className={btn} aria-label="Transpose up" onClick={() => setOpts((o) => ({ ...o, transpose: o.transpose + 1 }))}>+</button>
          <button type="button" className={btn} onClick={() => setOpts((o) => ({ ...o, capo: o.capo === 0 ? 2 : 0 }))}>
            {opts.capo ? `Capo ${opts.capo}` : "No capo"}
          </button>
          <button type="button" aria-pressed={opts.simplify} className={`${btn} ${opts.simplify ? "border-amber-400/70 text-amber-200" : ""}`} onClick={() => setOpts((o) => ({ ...o, simplify: !o.simplify }))}>
            Simplify
          </button>
        </div>
        <div className="mt-5 space-y-4">
          {shown.sections.map((s) => (
            <div key={s.label}>
              <p className="label-mono text-cream/40">{s.label}</p>
              {s.lines.map((line: Line, li) =>
                line.type === "bars" ? (
                  <div key={li} className="mt-1.5 grid grid-cols-4 overflow-hidden rounded-xl border border-cream/10">
                    {line.bars.map((bar, bi) => (
                      <div key={bi} className="border-l border-cream/10 px-2 py-3 first:border-l-0">
                        {bar.filter((b) => b !== ".").map((c) => {
                          const idx = chords.indexOf(c);
                          return (
                            <button
                              key={c}
                              type="button"
                              onClick={() => {
                                setPick(idx);
                                pluck(196);
                              }}
                              className={`font-mono text-base font-semibold sm:text-lg ${idx === pick ? "text-amber-300" : "text-cream hover:text-amber-200"}`}
                            >
                              {c}
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                ) : null,
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="min-w-0 rounded-2xl bg-black/30 p-4">
        <p className="label-mono text-cream/50">Picking tab · {chord}</p>
        {fing && fing.positions?.length ? (
          <pre className="mt-3 overflow-x-auto font-mono text-sm leading-tight text-cream/85">{chordTab(fing.positions, "arpeggio").join("\n")}</pre>
        ) : (
          <p className="mt-3 text-sm text-cream/50">{fing === undefined ? "Loading the shape…" : "Pick another chord to see its tab."}</p>
        )}
        <p className="mt-4 text-xs text-cream/40">Tabs follow transpose, capo and simplify — tap a chord in the chart.</p>
      </div>
    </div>
  );
}
