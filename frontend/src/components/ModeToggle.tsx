"use client";

import React from "react";

export type AppMode = "chords" | "song" | "transitions";

interface ModeToggleProps {
  mode: AppMode;
  onChange: (mode: AppMode) => void;
}

const MODES: { key: AppMode; label: string }[] = [
  { key: "chords", label: "🎸 Practice" },
  { key: "song", label: "🎵 Learn Song" },
  { key: "transitions", label: "🔄 Transitions" },
];

export default function ModeToggle({ mode, onChange }: ModeToggleProps) {
  const idx = MODES.findIndex((m) => m.key === mode);

  return (
    <div className="flex items-center justify-center mb-8">
      <div
        className="relative flex rounded-full p-1"
        style={{
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.12)",
          backdropFilter: "blur(12px)",
        }}
      >
        {/* sliding pill */}
        <div
          className="absolute top-1 bottom-1 rounded-full transition-all duration-300 ease-in-out"
          style={{
            background: "linear-gradient(135deg, #7c3aed, #2563eb, #0891b2)",
            width: "calc(33.333% - 5px)",
            left: idx === 0 ? "4px" : idx === 1 ? "calc(33.333% + 1px)" : "calc(66.666% + 2px)",
            boxShadow: "0 0 16px rgba(124, 58, 237, 0.5)",
          }}
        />
        {MODES.map((m) => (
          <button
            key={m.key}
            onClick={() => onChange(m.key)}
            className="relative z-10 px-5 py-2 rounded-full text-sm font-semibold transition-colors duration-200"
            style={{ color: mode === m.key ? "#fff" : "rgba(255,255,255,0.5)" }}
          >
            {m.label}
          </button>
        ))}
      </div>
    </div>
  );
}
