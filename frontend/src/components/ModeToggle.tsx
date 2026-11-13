"use client";

import React from "react";

export type AppMode = "chords" | "song" | "transitions";

interface ModeToggleProps {
  mode: AppMode;
  onChange: (mode: AppMode) => void;
}

const MODES: { key: AppMode; label: string; thing: string }[] = [
  { key: "chords", label: "Practice a chord", thing: "Amp" },
  { key: "song", label: "Learn any song", thing: "Record player" },
  { key: "transitions", label: "Chord changes", thing: "Metronome" },
];

/** The three ways to practise, as tabs named after their object in the room. */
export default function ModeToggle({ mode, onChange }: ModeToggleProps) {
  return (
    <div role="tablist" aria-label="Practice mode" className="grid grid-cols-3 gap-2 rounded-[20px] border border-cream/10 p-1.5">
      {MODES.map((m) => {
        const active = mode === m.key;
        return (
          <button
            key={m.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(m.key)}
            className={`rounded-2xl px-3 py-3 text-left transition-colors duration-fast sm:px-4 ${
              active ? "bg-amber-400 text-ink-950" : "text-cream/70 hover:bg-cream/5 hover:text-cream"
            }`}
          >
            <span className={`label-mono block text-[10px] ${active ? "text-ink-950/60" : "text-cream/40"}`}>{m.thing}</span>
            <span className="mt-0.5 block text-sm font-semibold leading-tight sm:text-base">{m.label}</span>
          </button>
        );
      })}
    </div>
  );
}
