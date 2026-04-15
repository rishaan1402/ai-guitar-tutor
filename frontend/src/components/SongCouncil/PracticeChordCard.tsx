"use client";

import React from "react";
import { PracticeChord } from "@/lib/api";

interface PracticeChordCardProps {
  chord: PracticeChord;
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
  const BAR_W = 4;
  const BAR_MAX_H = 20;
  const GAP = 2;
  const width = bars.length * (BAR_W + GAP) - GAP;

  return (
    <svg width={width} height={BAR_MAX_H} viewBox={`0 0 ${width} ${BAR_MAX_H}`}>
      {bars.map((s, i) => {
        const h = Math.max(2, Math.round(s * BAR_MAX_H));
        const color = s >= 0.8 ? "#22c55e" : s >= 0.5 ? "#eab308" : "#ef4444";
        return (
          <rect
            key={i}
            x={i * (BAR_W + GAP)}
            y={BAR_MAX_H - h}
            width={BAR_W}
            height={h}
            rx={1}
            fill={color}
            opacity={0.85}
          />
        );
      })}
    </svg>
  );
}

export default function PracticeChordCard({ chord, score, scoreHistory = [], chordFunction, onPractice }: PracticeChordCardProps) {
  return (
    <div
      className="glass-card p-3 flex flex-col items-center gap-2 transition-all duration-200"
      style={{
        border: score != null
          ? `1px solid ${scoreColor(score)}55`
          : "1px solid rgba(255,255,255,0.1)",
      }}
    >
      {/* Chord symbol */}
      <div className="gradient-text text-2xl font-bold">{chord.symbol}</div>

      {/* Roman numeral function */}
      {chordFunction && (
        <div
          className="text-center leading-tight"
          style={{ color: "rgba(167,139,250,0.7)", fontSize: "10px", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
          title={chordFunction}
        >
          {chordFunction}
        </div>
      )}

      {/* Score sparkline */}
      {scoreHistory.length > 0 && (
        <ScoreSparkline history={scoreHistory} />
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
          onClick={() => onPractice(chord.chord_key!)}
          className="btn-gradient text-xs font-semibold px-4 py-1.5 rounded-lg text-white w-full"
        >
          Practice
        </button>
      )}
    </div>
  );
}
