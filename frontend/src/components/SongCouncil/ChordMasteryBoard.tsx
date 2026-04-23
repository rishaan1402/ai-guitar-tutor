"use client";

import React, { useMemo } from "react";
import { LessonDocument } from "@/lib/api";
import EnhancedPracticeChordCard from "./EnhancedPracticeChordCard";

interface ChordMasteryBoardProps {
  lesson: LessonDocument;
  chordScores: Record<string, number>;
  chordScoreHistory: Record<string, number[]>;
  highlightedChords?: string[];   // chord_keys to highlight (from section click)
  activeSection?: string | null;
  onPracticeChord: (chordKey: string) => void;
}

/**
 * Grid of enhanced chord cards with fingering previews
 * Shows all practice chords organized with visual feedback on mastery
 */
export function ChordMasteryBoard({
  lesson,
  chordScores,
  chordScoreHistory,
  highlightedChords = [],
  activeSection,
  onPracticeChord,
}: ChordMasteryBoardProps) {
  const available = lesson.practice_chords.filter((c) => c.available_in_app && c.chord_key);
  const attemptedCount = available.filter((c) => chordScores[c.chord_key!] != null).length;

  // Build fingering lookup
  const fingeringMap = useMemo(() => {
    const map: Record<string, any> = {};
    if (lesson.practice_chords) {
      lesson.practice_chords.forEach((chord) => {
        if (chord.positions) {
          // Create ChordFingering-like object from practice_chord data
          map[chord.symbol] = {
            chord: chord.symbol,
            display_name: chord.symbol,
            root: "",
            quality: "",
            notes: [],
            positions: chord.positions,
          };
        }
      });
    }
    return map;
  }, [lesson.practice_chords]);

  return (
    <div className="space-y-4">
      {/* Progress header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-white">Chord Mastery</h3>
          {activeSection && (
            <span
              className="text-xs px-2.5 py-1 rounded-full font-medium"
              style={{
                background: "rgba(124,58,237,0.2)",
                border: "1px solid rgba(167,139,250,0.5)",
                color: "#c4b5fd",
              }}
            >
              Showing: {activeSection}
            </span>
          )}
        </div>
        <span className="text-sm text-gray-400">
          {attemptedCount}/{available.length} practiced
        </span>
      </div>

      {/* Progress bar */}
      {available.length > 0 && (
        <div
          className="w-full h-2 rounded-full overflow-hidden"
          style={{ background: "rgba(255,255,255,0.08)" }}
        >
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${(attemptedCount / available.length) * 100}%`,
              background: "linear-gradient(90deg, #7c3aed, #0891b2)",
            }}
          />
        </div>
      )}

      {/* Chord grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {lesson.practice_chords.map((chord) => {
          const isHighlighted =
            highlightedChords.length === 0 ||
            (chord.chord_key ? highlightedChords.includes(chord.chord_key) : false);

          return (
            <div
              key={chord.symbol}
              className="transition-all duration-300"
              style={{ opacity: isHighlighted ? 1 : 0.3, transform: isHighlighted ? "scale(1)" : "scale(0.97)" }}
            >
              <EnhancedPracticeChordCard
                chord={chord}
                fingering={fingeringMap[chord.symbol] || null}
                score={chord.chord_key ? chordScores[chord.chord_key] ?? null : null}
                scoreHistory={chord.chord_key ? chordScoreHistory[chord.chord_key] ?? [] : []}
                chordFunction={lesson.chord_functions?.[chord.symbol] ?? null}
                onPractice={onPracticeChord}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
