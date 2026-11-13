"use client";

import type { ChordFingering, FretPosition } from "@/lib/api";
import { fretString, prettySymbol } from "@/lib/chordShape";

interface Props {
  fingering: ChordFingering | null;
  /** Caption to show instead of the data's name (e.g. the symbol as written: "G/B"). */
  caption?: string;
  /** Positions to draw instead of the lesson shape (e.g. a slash-chord voicing). */
  positions?: FretPosition[];
  /** Small line under the diagram, e.g. when the shape is approximate. */
  note?: string;
  liveNotes?: string[]; // pitch-class names currently detected (e.g. ["G", "B", "D"])
  /** Scale to the container width (capped) instead of the fixed 100px thumbnail. */
  fluid?: boolean;
  className?: string;
}

const STRINGS = 6;
const FRETS_SHOWN = 5;
const STRING_SPACING = 14;
const FRET_SPACING = 18;
const LEFT_MARGIN = 18;
const TOP_MARGIN = 20;
const FRETBOARD_W = STRING_SPACING * (STRINGS - 1);
const FRETBOARD_H = FRET_SPACING * FRETS_SHOWN;
const SVG_W = FRETBOARD_W + LEFT_MARGIN + 12;
const SVG_H = FRETBOARD_H + TOP_MARGIN + 12;
const DOT_R = 5;

// Warm, distinct per finger; kept clear of the green/red used for scoring
const FINGER_COLORS: Record<number, string> = {
  1: "#e8a54b",
  2: "#86b092",
  3: "#e9d9b8",
  4: "#de7a5c",
};

export default function ChordDiagram({ fingering, caption, positions: override, note, liveNotes, fluid, className }: Props) {
  if (!fingering) return null;

  const positions = override ?? fingering.positions ?? [];
  const title = prettySymbol(caption ?? fingering.display_name);
  const sounding = Array.from(
    new Set(positions.filter((p) => p.action !== "mute" && p.note).map((p) => p.note as string)),
  );
  // One finger across several strings at the same fret = a barre
  const barres = Object.values(
    positions
      .filter((p) => p.finger && p.fret && p.fret > 0 && !p.action)
      .reduce<Record<string, { fret: number; strings: number[] }>>((acc, p) => {
        const k = `${p.finger}:${p.fret}`;
        (acc[k] ??= { fret: p.fret as number, strings: [] }).strings.push(p.string);
        return acc;
      }, {}),
  ).filter((b) => b.strings.length >= 2);
  const isLiveMode = liveNotes !== undefined && liveNotes.length >= 0;

  const playedFrets = positions
    .filter((p) => p.fret !== undefined && p.fret > 0 && !p.action)
    .map((p) => p.fret as number);

  let startFret = 1;
  if (playedFrets.length > 0) {
    const maxFret = Math.max(...playedFrets);
    const minFret = Math.min(...playedFrets);
    if (maxFret > 5) {
      startFret = minFret;
    }
  }

  const isOpenPosition = startFret === 1;

  const stringX = (s: number) => LEFT_MARGIN + (STRINGS - s) * STRING_SPACING;
  const fretY = (f: number) => TOP_MARGIN + (f - startFret) * FRET_SPACING + FRET_SPACING / 2;

  return (
    <div className={`glass-card ${fluid ? "w-full" : "w-fit self-start"} ${className ?? ""}`}>
      <p className="text-[10px] font-semibold gradient-text text-center mb-0.5">
        {title}
      </p>
      <svg
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        width={fluid ? undefined : SVG_W}
        height={fluid ? undefined : SVG_H}
        className={fluid ? "mx-auto block w-full h-auto" : "mx-auto"}
        role="img"
        aria-label={`${title} chord diagram, frets ${fretString(positions)} from low E`}
      >
        {/* Glow filter for live-detected notes */}
        <defs>
          <filter id="liveGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <rect
          x={LEFT_MARGIN - 4}
          y={TOP_MARGIN - 2}
          width={FRETBOARD_W + 8}
          height={FRETBOARD_H + 4}
          rx={2}
          fill="#32302d"
        />

        {isOpenPosition && (
          <rect
            x={LEFT_MARGIN - 1}
            y={TOP_MARGIN - 2}
            width={FRETBOARD_W + 2}
            height={3}
            fill="#f0ebe0"
            rx={1}
          />
        )}

        {Array.from({ length: FRETS_SHOWN + 1 }).map((_, i) => (
          <line
            key={`fret-${i}`}
            x1={LEFT_MARGIN}
            y1={TOP_MARGIN + i * FRET_SPACING}
            x2={LEFT_MARGIN + FRETBOARD_W}
            y2={TOP_MARGIN + i * FRET_SPACING}
            stroke="#a09888"
            strokeWidth={i === 0 ? 1.5 : 0.5}
          />
        ))}

        {Array.from({ length: STRINGS }).map((_, i) => (
          <line
            key={`string-${i}`}
            x1={LEFT_MARGIN + i * STRING_SPACING}
            y1={TOP_MARGIN}
            x2={LEFT_MARGIN + i * STRING_SPACING}
            y2={TOP_MARGIN + FRETBOARD_H}
            stroke="#c8c8c8"
            strokeWidth={1.2 - i * 0.1}
          />
        ))}

        {!isOpenPosition && (
          <text
            x={LEFT_MARGIN - 8}
            y={TOP_MARGIN + FRET_SPACING / 2 + 3}
            fontSize={7}
            fill="#9ca3af"
            textAnchor="middle"
          >
            {startFret}
          </text>
        )}

        {positions.map((pos, i) => {
          const x = stringX(pos.string);
          const y = TOP_MARGIN - 8;

          if (pos.action === "mute") {
            return (
              <text key={`m-${i}`} x={x} y={y} fontSize={7} fill="#e8604f" textAnchor="middle" fontWeight="bold">
                X
              </text>
            );
          }
          if (pos.fret === 0) {
            const isLive = isLiveMode && pos.note && liveNotes!.includes(pos.note);
            return (
              <text
                key={`o-${i}`}
                x={x}
                y={y}
                fontSize={7}
                fill={isLiveMode ? (isLive ? "#a3c6ab" : "#a3c6ab55") : "#a3c6ab"}
                textAnchor="middle"
                fontWeight="bold"
                filter={isLive ? "url(#liveGlow)" : undefined}
              >
                O
              </text>
            );
          }
          return null;
        })}

        {barres.map((b) => {
          const xs = b.strings.map(stringX);
          return (
            <rect
              key={`barre-${b.fret}-${b.strings.join("")}`}
              x={Math.min(...xs) - DOT_R}
              y={fretY(b.fret) - DOT_R}
              width={Math.max(...xs) - Math.min(...xs) + DOT_R * 2}
              height={DOT_R * 2}
              rx={DOT_R}
              fill={FINGER_COLORS[1]}
              opacity={isLiveMode ? 0.3 : 0.55}
            />
          );
        })}

        {positions
          .filter((p) => p.fret !== undefined && p.fret > 0 && !p.action)
          .map((pos, i) => {
            const x = stringX(pos.string);
            const y = fretY(pos.fret as number);
            const baseColor = pos.finger ? FINGER_COLORS[pos.finger] || "#6b7280" : "#6b7280";
            const isLive = isLiveMode && pos.note && liveNotes!.includes(pos.note);
            const fill = isLiveMode
              ? isLive ? "#a3c6ab" : `${baseColor}44`
              : baseColor;

            return (
              <g key={`d-${i}`}>
                <circle
                  cx={x}
                  cy={y}
                  r={isLive ? DOT_R + 1 : DOT_R}
                  fill={fill}
                  stroke={isLive ? "#a3c6ab" : "rgba(28,18,6,0.6)"}
                  strokeWidth={isLive ? 1.5 : 0.8}
                  filter={isLive ? "url(#liveGlow)" : undefined}
                  style={{ transition: "fill 0.15s, r 0.1s" }}
                />
                {pos.finger && !isLiveMode && (
                  <text x={x} y={y + 2.2} fontSize={6} fill="#1c1206" textAnchor="middle" fontWeight="bold" aria-hidden>
                    {pos.finger}
                  </text>
                )}
              </g>
            );
          })}
      </svg>
      <p className="text-[8px] text-gray-500 text-center mt-0.5">
        {(override ? sounding : fingering.notes).join(" ")}
      </p>
      {note && <p className="text-[9px] text-amber-300/80 text-center mt-0.5">{note}</p>}
    </div>
  );
}
