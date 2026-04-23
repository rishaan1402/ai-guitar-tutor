"use client";

import React from "react";
import type { ChordFingering } from "@/lib/api";

interface FretboardVisualizerProps {
  fingering: ChordFingering | null;
  detectedNotes: string[];
  missingNotes: string[];
  extraNotes: string[];
}

/**
 * Interactive fretboard visualizer showing chord with detected notes
 * Green: detected correctly
 * Red outline: expected but missing (pulsing)
 * Yellow: extra notes
 * Muted strings shown with ✕
 */
export function FretboardVisualizer({
  fingering,
  detectedNotes,
  missingNotes,
  extraNotes,
}: FretboardVisualizerProps) {
  if (!fingering) return null;

  const STRINGS = 6;
  const FRETS_SHOWN = 5;
  const STRING_SPACING = 16;
  const FRET_SPACING = 20;
  const LEFT_MARGIN = 20;
  const TOP_MARGIN = 24;
  const DOT_R = 6;

  const FRETBOARD_W = STRING_SPACING * (STRINGS - 1);
  const FRETBOARD_H = FRET_SPACING * FRETS_SHOWN;
  const SVG_W = FRETBOARD_W + LEFT_MARGIN + 16;
  const SVG_H = FRETBOARD_H + TOP_MARGIN + 16;

  const positions = fingering.positions || [];
  const playedFrets = positions
    .filter((p) => p.fret !== undefined && p.fret > 0 && !p.action)
    .map((p) => p.fret as number);

  let startFret = 1;
  if (playedFrets.length > 0) {
    const maxFret = Math.max(...playedFrets);
    if (maxFret > 5) {
      startFret = Math.max(1, Math.min(...playedFrets));
    }
  }

  const stringX = (s: number) => LEFT_MARGIN + (STRINGS - s) * STRING_SPACING;
  const fretY = (f: number) => TOP_MARGIN + (f - startFret) * FRET_SPACING + FRET_SPACING / 2;

  return (
    <div className="glass-card p-4 flex flex-col items-center gap-3">
      <h4 className="text-sm font-semibold text-white">Chord Fretboard</h4>

      <svg
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        width={280}
        height={SVG_H}
        className="mx-auto"
        aria-label={`Chord diagram for ${fingering.display_name}`}
      >
        {/* Glow filters */}
        <defs>
          <filter id="missingGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <style>{`
            @keyframes pulse-ring {
              0%, 100% { r: 6; stroke-width: 1; opacity: 0.8; }
              50% { r: 8; stroke-width: 1.5; opacity: 0.4; }
            }
            .missing-note {
              animation: pulse-ring 1.5s ease-in-out infinite;
            }
          `}</style>
        </defs>

        {/* Fretboard background */}
        <rect
          x={LEFT_MARGIN - 2}
          y={TOP_MARGIN - 2}
          width={FRETBOARD_W + 4}
          height={FRETBOARD_H + 4}
          rx={2}
          fill="#2a2825"
        />

        {/* Open position indicator */}
        {startFret === 1 && (
          <rect
            x={LEFT_MARGIN - 1}
            y={TOP_MARGIN - 2}
            width={FRETBOARD_W + 2}
            height={3}
            fill="#f0ebe0"
            rx={1}
          />
        )}

        {/* Frets */}
        {Array.from({ length: FRETS_SHOWN + 1 }).map((_, i) => (
          <line
            key={`fret-${i}`}
            x1={LEFT_MARGIN}
            y1={TOP_MARGIN + i * FRET_SPACING}
            x2={LEFT_MARGIN + FRETBOARD_W}
            y2={TOP_MARGIN + i * FRET_SPACING}
            stroke="rgba(255,255,255,0.15)"
            strokeWidth={1}
          />
        ))}

        {/* Strings */}
        {Array.from({ length: STRINGS }).map((_, i) => (
          <line
            key={`string-${i}`}
            x1={stringX(i + 1)}
            y1={TOP_MARGIN}
            x2={stringX(i + 1)}
            y2={TOP_MARGIN + FRETBOARD_H}
            stroke="rgba(255,255,255,0.2)"
            strokeWidth={1}
          />
        ))}

        {/* Chord positions (fingered notes) */}
        {positions.map((pos, idx) => {
          if (!pos.fret || pos.fret <= 0 || pos.action) return null;

          const x = stringX(pos.string);
          const y = fretY(pos.fret);
          const note = pos.note || "";

          const isDetected = detectedNotes.includes(note);
          const isMissing = missingNotes.includes(note);
          const isExtra = extraNotes.includes(note);

          let fillColor = "#a78bfa"; // purple - untested
          let strokeColor = "rgba(167,139,250,0.5)";

          if (isDetected && !isMissing) {
            fillColor = "#22c55e"; // green - correct
            strokeColor = "rgba(34,197,94,0.7)";
          } else if (isMissing) {
            fillColor = "rgba(239,68,68,0.2)"; // red with transparency
            strokeColor = "#ef4444";
          }

          return (
            <g key={idx}>
              {/* Background circle */}
              <circle
                cx={x}
                cy={y}
                r={DOT_R}
                fill={fillColor}
                opacity={0.9}
                className={isMissing ? "missing-note" : ""}
              />

              {/* Border for missing notes */}
              {isMissing && (
                <circle
                  cx={x}
                  cy={y}
                  r={DOT_R}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={1.5}
                  filter="url(#missingGlow)"
                />
              )}

              {/* Finger number label */}
              {pos.finger && (
                <text
                  x={x}
                  y={y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="10"
                  fontWeight="bold"
                  fill="#fff"
                  pointerEvents="none"
                >
                  {pos.finger}
                </text>
              )}
            </g>
          );
        })}

        {/* Muted strings */}
        {positions.map((pos, idx) => {
          if (pos.action !== "mute") return null;

          const x = stringX(pos.string);
          const y = TOP_MARGIN - 8;

          return (
            <text
              key={`mute-${idx}`}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="14"
              fill="rgba(239,68,68,0.6)"
              fontWeight="bold"
            >
              ✕
            </text>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-3 text-xs w-full">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ background: "#22c55e" }} />
          <span className="text-gray-300">Detected</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full border-2" style={{ borderColor: "#ef4444" }} />
          <span className="text-gray-300">Missing</span>
        </div>
      </div>
    </div>
  );
}
