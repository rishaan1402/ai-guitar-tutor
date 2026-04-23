"use client";

import React from "react";
import { LessonDocument } from "@/lib/api";

interface SongTimelineProps {
  lesson: LessonDocument;
  chordScores: Record<string, number>;
  activeSection: string | null;
  onSectionClick: (sectionName: string) => void;
}

/**
 * Horizontal scrollable timeline of song sections
 * Colored by mastery of contained chords
 */
export function SongTimeline({ lesson, chordScores, activeSection, onSectionClick }: SongTimelineProps) {
  if (!lesson.song_sections || lesson.song_sections.length === 0) {
    return null;
  }

  // Calculate mastery color for each section based on its chords
  const getSectionColor = (sectionChords: string[]): string => {
    if (sectionChords.length === 0) return "rgba(75,85,99,0.4)"; // neutral gray

    const scores = sectionChords
      .map((chord) => {
        const practiceChord = lesson.practice_chords.find((pc) => pc.symbol === chord);
        return practiceChord?.chord_key ? chordScores[practiceChord.chord_key] : null;
      })
      .filter((s): s is number => s !== null);

    if (scores.length === 0) {
      return "rgba(75,85,99,0.4)"; // not yet attempted
    }

    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;

    if (avgScore >= 0.8) return "rgba(34,197,94,0.3)"; // green - mastered
    if (avgScore >= 0.5) return "rgba(234,179,8,0.3)"; // yellow - intermediate
    return "rgba(239,68,68,0.3)"; // red - needs work
  };

  const activeData = activeSection
    ? lesson.song_sections.find((s) => s.name === activeSection)
    : null;

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <div className="flex gap-2 pb-2 min-w-max px-0.5">
          {lesson.song_sections.map((section, idx) => {
            const isActive = activeSection === section.name;
            return (
              <button
                key={idx}
                onClick={() => onSectionClick(section.name)}
                className="px-4 py-2 rounded-lg transition-all flex-shrink-0 text-sm font-medium"
                style={{
                  background: isActive
                    ? "rgba(124,58,237,0.35)"
                    : getSectionColor(section.chords),
                  border: isActive
                    ? "2px solid rgba(167,139,250,0.9)"
                    : "1px solid rgba(255,255,255,0.2)",
                  color: "rgba(255,255,255,0.95)",
                  transform: isActive ? "scale(1.08)" : undefined,
                  boxShadow: isActive ? "0 0 12px rgba(124,58,237,0.4)" : undefined,
                }}
              >
                {section.name}
                {section.chords.length > 0 && (
                  <span className="ml-1 text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
                    ({section.chords.length})
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Active section chord preview */}
      {activeData && activeData.chords.length > 0 && (
        <div
          className="flex items-center gap-2 flex-wrap px-1"
          style={{ animation: "fade-in-up 0.2s ease-out both" }}
        >
          <span className="text-xs text-gray-400 uppercase font-mono">{activeData.name}:</span>
          {activeData.chords.map((chord) => (
            <span
              key={chord}
              className="text-xs px-2.5 py-1 rounded-full font-semibold"
              style={{
                background: "rgba(124,58,237,0.2)",
                border: "1px solid rgba(167,139,250,0.5)",
                color: "#c4b5fd",
              }}
            >
              {chord}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
