"use client";

import React from "react";
import { PracticeChord } from "@/lib/api";

interface PracticeChordCardProps {
  chord: PracticeChord;
  score?: number | null;
  onPractice: (chordKey: string) => void;
}

function scoreColor(score: number) {
  if (score >= 0.8) return "#22c55e";
  if (score >= 0.5) return "#eab308";
  return "#ef4444";
}

export default function PracticeChordCard({ chord, score, onPractice }: PracticeChordCardProps) {
  return (
    <div
      className="glass-card p-4 flex flex-col items-center gap-3 transition-all duration-200"
      style={{
        border: score != null
          ? `1px solid ${scoreColor(score)}55`
          : "1px solid rgba(255,255,255,0.1)",
      }}
    >
      {/* Chord symbol */}
      <div className="gradient-text text-2xl font-bold">{chord.symbol}</div>

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
