"use client";

import React, { useState } from "react";

interface FingeringTipCardProps {
  note: string;
  string: number;
  fret: number;
  finger?: number | null;
  tip: string;
  onFeedback?: (tipId: string, helpful: boolean) => void;
}

/**
 * Individual fingering tip card with feedback buttons
 * Shows the specific finger/string with interactive tip
 * Users can mark tips as helpful or unclear
 */
export function FingeringTipCard({
  note,
  string,
  fret,
  finger,
  tip,
  onFeedback,
}: FingeringTipCardProps) {
  const [feedback, setFeedback] = useState<boolean | null>(null);

  const handleFeedback = (helpful: boolean) => {
    setFeedback(helpful);
    const tipId = `${note}-${string}-${fret}`;
    onFeedback?.(tipId, helpful);
  };

  return (
    <div className="glass-card p-4 space-y-2">
      {/* Header with fingering info */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
            style={{
              background:
                finger === 1
                  ? "rgba(59,130,246,0.4)"
                  : finger === 2
                  ? "rgba(34,197,94,0.4)"
                  : finger === 3
                  ? "rgba(245,158,11,0.4)"
                  : "rgba(239,68,68,0.4)",
              border:
                finger === 1
                  ? "1px solid rgba(59,130,246,0.7)"
                  : finger === 2
                  ? "1px solid rgba(34,197,94,0.7)"
                  : finger === 3
                  ? "1px solid rgba(245,158,11,0.7)"
                  : "1px solid rgba(239,68,68,0.7)",
            }}
          >
            {finger || "?"}
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold text-white">
              {note} • String {string}
            </span>
            <span className="text-xs text-gray-400">Fret {fret}</span>
          </div>
        </div>
      </div>

      {/* Tip text */}
      <p className="text-sm text-gray-300 leading-relaxed">{tip}</p>

      {/* Feedback buttons */}
      <div className="flex gap-2 pt-2">
        <button
          onClick={() => handleFeedback(true)}
          className="flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200"
          style={{
            background:
              feedback === true
                ? "rgba(34,197,94,0.2)"
                : "rgba(34,197,94,0.05)",
            border:
              feedback === true
                ? "1px solid rgba(34,197,94,0.6)"
                : "1px solid rgba(34,197,94,0.2)",
            color: feedback === true ? "#86efac" : "rgba(134,239,172,0.6)",
          }}
        >
          👍 Helped
        </button>
        <button
          onClick={() => handleFeedback(false)}
          className="flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200"
          style={{
            background:
              feedback === false
                ? "rgba(239,68,68,0.2)"
                : "rgba(239,68,68,0.05)",
            border:
              feedback === false
                ? "1px solid rgba(239,68,68,0.6)"
                : "1px solid rgba(239,68,68,0.2)",
            color: feedback === false ? "#fca5a5" : "rgba(252,165,165,0.6)",
          }}
        >
          😕 Unclear
        </button>
      </div>
    </div>
  );
}
