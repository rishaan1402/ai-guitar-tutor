"use client";

import React, { useState } from "react";
import { PracticeChord, ChordFingering } from "@/lib/api";
import ChordDiagram from "@/components/ChordDiagram";

interface EnhancedPracticeChordCardProps {
  chord: PracticeChord;
  fingering?: ChordFingering | null;
  score?: number | null;
  scoreHistory?: number[];
  chordFunction?: string | null;
  onPractice: (chordKey: string) => void;
}

function scoreColor(score: number) {
  if (score >= 0.8) return "#22c55e";
  if (score >= 0.5) return "#eab308";
  return "#ef4444";
}

function ScoreSparkline({ history }: { history: number[] }) {
  if (history.length === 0) return null;
  const bars = history.slice(-5); // last 5 attempts
  const BAR_W = 3;
  const BAR_MAX_H = 16;
  const GAP = 1;
  const width = bars.length * (BAR_W + GAP) - GAP;

  return (
    <svg width={width} height={BAR_MAX_H} viewBox={`0 0 ${width} ${BAR_MAX_H}`}>
      {bars.map((s, i) => {
        const h = Math.max(1, Math.round(s * BAR_MAX_H));
        const color = s >= 0.8 ? "#22c55e" : s >= 0.5 ? "#eab308" : "#ef4444";
        return (
          <rect
            key={i}
            x={i * (BAR_W + GAP)}
            y={BAR_MAX_H - h}
            width={BAR_W}
            height={h}
            rx={0.5}
            fill={color}
            opacity={0.85}
          />
        );
      })}
    </svg>
  );
}

/**
 * Enhanced chord card with fingering diagram preview, chord function, and score history
 * Used in ChordMasteryBoard for interactive practice from within lesson
 */
export default function EnhancedPracticeChordCard({
  chord,
  fingering,
  score,
  scoreHistory = [],
  chordFunction,
  onPractice,
}: EnhancedPracticeChordCardProps) {
  const [showDiagram, setShowDiagram] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      {/* Main card */}
      <div
        className="glass-card p-4 flex flex-col items-center gap-2 transition-all duration-200 cursor-pointer hover:border-white/30"
        style={{
          border: score != null ? `1px solid ${scoreColor(score)}55` : "1px solid rgba(255,255,255,0.1)",
        }}
        onClick={() => setShowDiagram(!showDiagram)}
      >
        {/* Chord symbol */}
        <div className="gradient-text text-xl font-bold">{chord.symbol}</div>

        {/* Roman numeral function */}
        {chordFunction && (
          <div
            className="text-center leading-tight text-xs"
            style={{ color: "rgba(167,139,250,0.7)" }}
            title={chordFunction}
          >
            {chordFunction}
          </div>
        )}

        {/* Score sparkline */}
        {scoreHistory.length > 0 && (
          <div className="flex justify-center">
            <ScoreSparkline history={scoreHistory} />
          </div>
        )}

        {/* Score badge if practiced */}
        {score != null && (
          <div
            className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{
              background: `${scoreColor(score)}22`,
              border: `1px solid ${scoreColor(score)}55`,
              color: scoreColor(score),
            }}
          >
            {Math.round(score * 100)}%
          </div>
        )}

        {/* Not-in-app badge */}
        {!chord.available_in_app && (
          <span
            className="text-xs px-2 py-0.5 rounded-full"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.4)",
            }}
          >
            not in app
          </span>
        )}

        {chord.available_in_app && chord.chord_key && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPractice(chord.chord_key!);
            }}
            className="btn-gradient text-xs font-semibold px-3 py-1.5 rounded-lg text-white w-full"
          >
            Practice
          </button>
        )}
      </div>

      {/* Fingering preview (if available) */}
      {showDiagram && fingering && (
        <div className="flex justify-center">
          <ChordDiagram fingering={fingering} />
        </div>
      )}
    </div>
  );
}
