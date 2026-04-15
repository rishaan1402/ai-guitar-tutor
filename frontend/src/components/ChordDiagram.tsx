"use client";

import type { ChordFingering } from "@/lib/api";

interface Props {
  fingering: ChordFingering | null;
  liveNotes?: string[]; // pitch-class names currently detected (e.g. ["G", "B", "D"])
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

const FINGER_COLORS: Record<number, string> = {
  1: "#3b82f6",
  2: "#22c55e",
  3: "#f59e0b",
  4: "#ef4444",
};

export default function ChordDiagram({ fingering, liveNotes }: Props) {
  if (!fingering) return null;

  const positions = fingering.positions || [];
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
    <div className="glass-card w-fit self-start">
      <p className="text-[10px] font-semibold gradient-text text-center mb-0.5">
        {fingering.display_name}
      </p>
      <svg
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        width={SVG_W}
        height={SVG_H}
        className="mx-auto"
        aria-label={`Chord diagram for ${fingering.display_name}`}
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
              <text key={`m-${i}`} x={x} y={y} fontSize={7} fill="#ef4444" textAnchor="middle" fontWeight="bold">
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
                fill={isLiveMode ? (isLive ? "#22c55e" : "#4ade8055") : "#4ade80"}
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

        {positions
          .filter((p) => p.fret !== undefined && p.fret > 0 && !p.action)
          .map((pos, i) => {
            const x = stringX(pos.string);
            const y = fretY(pos.fret as number);
            const baseColor = pos.finger ? FINGER_COLORS[pos.finger] || "#6b7280" : "#6b7280";
            const isLive = isLiveMode && pos.note && liveNotes!.includes(pos.note);
            const fill = isLiveMode
              ? isLive ? "#22c55e" : `${baseColor}44`
              : baseColor;

            return (
              <circle
                key={`d-${i}`}
                cx={x}
                cy={y}
                r={isLive ? DOT_R + 1 : DOT_R}
                fill={fill}
                stroke={isLive ? "#22c55e" : "#fff"}
                strokeWidth={isLive ? 1.5 : 0.8}
                filter={isLive ? "url(#liveGlow)" : undefined}
                style={{ transition: "fill 0.15s, r 0.1s" }}
              />
            );
          })}
      </svg>
      <p className="text-[8px] text-gray-500 text-center mt-0.5">
        {fingering.notes.join(" ")}
      </p>
    </div>
  );
}
