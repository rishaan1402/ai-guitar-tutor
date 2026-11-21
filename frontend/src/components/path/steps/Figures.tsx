"use client";

/** Pictures and sounds inside lessons: fretboard maps, tab, chord shapes, listen buttons. */
import { useEffect, useState } from "react";
import ChordDiagram from "@/components/ChordDiagram";
import { fingeringFor } from "@/lib/chords/shape";
import type { ChordFingering } from "@/lib/api";
import type { Dot, Figure } from "@/lib/path/steps";
import { playChord, playNotes } from "@/lib/path/synth";

export function FigureView({ figure }: { figure: Figure }) {
  switch (figure.kind) {
    case "fretboard":
      return <Fretboard dots={figure.dots} from={figure.from} to={figure.to} caption={figure.caption} />;
    case "tab":
      return (
        <figure className="overflow-x-auto rounded-2xl border border-cream/10 bg-ink-900/60 p-3">
          <pre className="font-mono text-[13px] leading-[1.35] text-cream/85">{figure.tab}</pre>
          {figure.caption && <figcaption className="label-mono mt-2 text-[10px] text-cream/45">{figure.caption}</figcaption>}
        </figure>
      );
    case "chord":
      return <ChordFigure chord={figure.chord} />;
    case "sound":
      return <SoundButton figure={figure} />;
  }
}

function ChordFigure({ chord }: { chord: string }) {
  const [shape, setShape] = useState<ChordFingering | null>(null);
  useEffect(() => {
    fingeringFor(chord).then(setShape).catch(() => {});
  }, [chord]);
  if (!shape) return <div className="flex h-40 w-32 items-center justify-center rounded-2xl border border-cream/10 font-display text-2xl text-cream">{chord}</div>;
  return (
    <button type="button" onClick={() => playChord(chord)} className="w-32 shrink-0" aria-label={`${chord}: tap to hear it`}>
      <ChordDiagram fingering={shape} caption={chord} fluid />
    </button>
  );
}

function SoundButton({ figure }: { figure: Extract<Figure, { kind: "sound" }> }) {
  const [on, setOn] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        setOn(true);
        let dur = 1.5;
        if (figure.chord) playChord(figure.chord);
        else if (figure.notes) dur = playNotes(figure.notes, figure.gap ?? 0.45, figure.together);
        setTimeout(() => setOn(false), dur * 1000);
      }}
      className={`inline-flex h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold ${on ? "border-amber-400 bg-amber-400/15 text-amber-100" : "border-cream/15 text-cream/85"}`}
    >
      <span aria-hidden="true">{on ? "♪" : "▶"}</span> {figure.label}
    </button>
  );
}

const STRING_LABEL = ["", "e", "B", "G", "D", "A", "E"];

/** A horizontal neck like tab: high e on top, low E at the bottom. */
export function Fretboard({ dots, from, to, caption, active }: { dots: Dot[]; from?: number; to?: number; caption?: string; active?: number }) {
  const frets = dots.map((d) => d.fret);
  const lo = from ?? Math.max(0, Math.min(...frets, 99) - 1);
  const hi = Math.max(to ?? Math.max(...frets, 0) + 1, lo + 4);
  const n = hi - lo; // fret spaces drawn
  const W = 60 + n * 58, H = 150, top = 18, gap = 22;
  const x = (f: number) => (f === 0 ? 30 : 46 + (f - lo - 0.5) * 58);
  const y = (s: number) => top + (s - 1) * gap;
  return (
    <figure className="overflow-x-auto rounded-2xl border border-cream/10 bg-ink-900/60 p-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto min-w-[280px] w-full max-w-[560px]" role="img" aria-label={caption ?? "Fretboard diagram"}>
        {/* fret markers */}
        {[3, 5, 7, 9, 15].filter((f) => f > lo && f <= hi).map((f) => (
          <circle key={f} cx={x(f)} cy={top + 2.5 * gap} r="4" fill="rgba(243,234,216,0.12)" />
        ))}
        {hi >= 12 && lo < 12 && [1.5, 3.5].map((k) => <circle key={k} cx={x(12)} cy={top + k * gap} r="4" fill="rgba(243,234,216,0.12)" />)}
        {/* frets */}
        {Array.from({ length: n + 1 }, (_, k) => (
          <line key={k} x1={46 + k * 58} x2={46 + k * 58} y1={top} y2={top + 5 * gap} stroke={k === 0 && lo === 0 ? "#f3ead8" : "rgba(243,234,216,0.3)"} strokeWidth={k === 0 && lo === 0 ? 4 : 1.5} />
        ))}
        {/* strings */}
        {[1, 2, 3, 4, 5, 6].map((s) => (
          <g key={s}>
            <line x1={46} x2={46 + n * 58} y1={y(s)} y2={y(s)} stroke="rgba(243,234,216,0.45)" strokeWidth={0.8 + s * 0.25} />
            <text x={8} y={y(s) + 4} fontSize="11" fill="rgba(243,234,216,0.45)" fontFamily="monospace">{STRING_LABEL[s]}</text>
          </g>
        ))}
        {/* fret numbers */}
        {Array.from({ length: n }, (_, k) => lo + k + 1).map((f) => (
          <text key={f} x={x(f)} y={H - 4} fontSize="10" textAnchor="middle" fill="rgba(243,234,216,0.4)" fontFamily="monospace">{f}</text>
        ))}
        {/* dots */}
        {dots.map((d, k) => {
          const root = d.role === "root", ghost = d.role === "ghost", isActive = active === k;
          return (
            <g key={k}>
              <circle
                cx={x(d.fret)}
                cy={y(d.string)}
                r={isActive ? 11 : 9.5}
                fill={ghost ? "transparent" : root ? "#e8a54b" : isActive ? "#a3c6ab" : "#f3ead8"}
                stroke={ghost ? "#f3ead8" : isActive ? "#a3c6ab" : "#0c0a09"}
                strokeWidth={ghost ? 1.5 : 1.5}
              />
              {d.label && (
                <text x={x(d.fret)} y={y(d.string) + 3.5} fontSize="9.5" fontWeight="700" textAnchor="middle" fill={ghost ? "#f3ead8" : "#0c0a09"}>
                  {d.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {caption && <figcaption className="label-mono mt-1 px-1 text-[10px] text-cream/45">{caption}</figcaption>}
    </figure>
  );
}
