"use client";

import React from "react";

export type AppMode = "chords" | "song";

interface ModeToggleProps {
  mode: AppMode;
  onChange: (mode: AppMode) => void;
}

export default function ModeToggle({ mode, onChange }: ModeToggleProps) {
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
            width: "calc(50% - 4px)",
            left: mode === "chords" ? "4px" : "calc(50%)",
            boxShadow: "0 0 16px rgba(124, 58, 237, 0.5)",
          }}
        />
        <button
          onClick={() => onChange("chords")}
          className="relative z-10 px-6 py-2 rounded-full text-sm font-semibold transition-colors duration-200"
          style={{ color: mode === "chords" ? "#fff" : "rgba(255,255,255,0.5)" }}
        >
          🎸 Practice Chords
        </button>
        <button
          onClick={() => onChange("song")}
          className="relative z-10 px-6 py-2 rounded-full text-sm font-semibold transition-colors duration-200"
          style={{ color: mode === "song" ? "#fff" : "rgba(255,255,255,0.5)" }}
        >
          🎵 Learn a Song
        </button>
      </div>
    </div>
  );
}
