"use client";

import React, { useMemo } from "react";
import { LessonDocument } from "@/lib/api";
import EnhancedPracticeChordCard from "./EnhancedPracticeChordCard";

interface ChordMasteryBoardProps {
  lesson: LessonDocument;
  chordScores: Record<string, number>;
  chordScoreHistory: Record<string, number[]>;
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
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Chord Mastery</h3>
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
        {lesson.practice_chords.map((chord) => (
          <EnhancedPracticeChordCard
            key={chord.symbol}
            chord={chord}
            fingering={fingeringMap[chord.symbol] || null}
            score={chord.chord_key ? chordScores[chord.chord_key] ?? null : null}
            scoreHistory={chord.chord_key ? chordScoreHistory[chord.chord_key] ?? [] : []}
            chordFunction={lesson.chord_functions?.[chord.symbol] ?? null}
            onPractice={onPracticeChord}
          />
        ))}
      </div>
    </div>
  );
}
