"use client";

import React from "react";
import { LessonDocument } from "@/lib/api";

interface SongTimelineProps {
  lesson: LessonDocument;
  chordScores: Record<string, number>;
  onSectionClick: (sectionName: string) => void;
}

/**
 * Horizontal scrollable timeline of song sections
 * Colored by mastery of contained chords
 */
export function SongTimeline({ lesson, chordScores, onSectionClick }: SongTimelineProps) {
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

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-2 pb-2 min-w-max px-0.5">
        {lesson.song_sections.map((section, idx) => (
          <button
            key={idx}
            onClick={() => onSectionClick(section.name)}
            className="glass-card px-4 py-2 rounded-lg transition-all hover:scale-105 flex-shrink-0 text-sm font-medium"
            style={{
              background: getSectionColor(section.chords),
              border: "1px solid rgba(255,255,255,0.2)",
              color: "rgba(255,255,255,0.9)",
            }}
          >
            {section.name}
            {section.chords.length > 0 && (
              <span className="ml-1 text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
                ({section.chords.length})
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
