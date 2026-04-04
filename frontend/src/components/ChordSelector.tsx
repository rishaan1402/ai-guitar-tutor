"use client";

import { useEffect, useState } from "react";
import { listChords } from "@/lib/api";

interface Props {
  onSelect: (chord: string) => void;
  disabled?: boolean;
  chordStatuses?: Record<string, "not_attempted" | "in_progress" | "mastered">;
}

type Difficulty = "beginner" | "intermediate" | "advanced";
type Filter = "all" | Difficulty;

function getDifficulty(chord: string): Difficulty {
  const q = chord.split("_").slice(1).join("_");
  if (!q || q === "major" || q === "minor" || q === "power") return "beginner";
  if (q === "dominant7" || q === "major7" || q === "minor7") return "intermediate";
  return "advanced";
}

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  beginner: "text-green-400 bg-green-500/10 border-green-500/20",
  intermediate: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  advanced: "text-red-400 bg-red-500/10 border-red-500/20",
};

export default function ChordSelector({ onSelect, disabled, chordStatuses }: Props) {
  const [chords, setChords] = useState<string[]>([]);
  const [selected, setSelected] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    listChords()
      .then((data) => setChords(data.chords))
      .catch((err) => setError(err.message));
  }, []);

  const counts: Record<Filter, number> = {
    all: chords.length,
    beginner: chords.filter((c) => getDifficulty(c) === "beginner").length,
    intermediate: chords.filter((c) => getDifficulty(c) === "intermediate").length,
    advanced: chords.filter((c) => getDifficulty(c) === "advanced").length,
  };

  const filtered = chords.filter((c) => {
    const matchSearch = c.replace(/_/g, " ").toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" || getDifficulty(c) === filter;
    return matchSearch && matchFilter;
  });

  if (error) {
    return <p className="text-red-400">Failed to load chords: {error}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search chords..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            disabled={disabled}
            className="glass w-full pl-9 pr-4 py-2 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 disabled:opacity-50"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {(["all", "beginner", "intermediate", "advanced"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              disabled={disabled}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all disabled:opacity-50 ${
                filter === f
                  ? "bg-purple-500/20 text-purple-300 border-purple-500/40"
                  : "bg-white/5 text-gray-400 border-white/10 hover:bg-white/10"
              }`}
            >
              {f === "all" ? "All" : DIFFICULTY_LABELS[f]} ({counts[f]})
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-8">No chords found</p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 max-h-72 overflow-y-auto pr-1 scrollbar-thin">
          {filtered.map((chord) => {
            const diff = getDifficulty(chord);
            const status = chordStatuses?.[chord] || "not_attempted";
            const isSelected = selected === chord;

            return (
              <button
                key={chord}
                onClick={() => setSelected(isSelected ? "" : chord)}
                disabled={disabled}
                className={`
                  glass-card flex flex-col items-center gap-1 p-2 rounded-xl text-center
                  transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed
                  ${isSelected ? "glow-border-active" : "hover:glass-hover"}
                `}
              >
                <span className="text-xs font-semibold text-white leading-tight">
                  {chord.replace(/_/g, " ")}
                </span>
                <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full border ${DIFFICULTY_COLORS[diff]}`}>
                  {DIFFICULTY_LABELS[diff].slice(0, 3)}
                </span>
                {status === "mastered" && (
                  <svg className="w-3 h-3 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                )}
                {status === "in_progress" && (
                  <div className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                )}
              </button>
            );
          })}
        </div>
      )}

      {selected && (
        <div
          className="flex justify-end"
          style={{ animation: "fade-in-up 0.2s ease-out both" }}
        >
          <button
            onClick={() => { if (selected) onSelect(selected); }}
            disabled={disabled}
            className="btn-gradient px-6 py-2.5 rounded-xl font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Start Lesson — {selected.replace(/_/g, " ")}
          </button>
        </div>
      )}
    </div>
  );
}
