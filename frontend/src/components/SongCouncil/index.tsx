"use client";

import React, { useState } from "react";
import {
  LessonDocument,
  generateSongLesson,
  getSongTip,
  reviseSongLesson,
  TipRequest,
  TipResponse,
} from "@/lib/api";
import SongSearchBar from "./SongSearchBar";
import CouncilProgress from "./CouncilProgress";
import LessonDisplay from "./LessonDisplay";

interface SongCouncilProps {
  onPracticeChord: (chordKey: string, lessonContext: SongCouncilContext) => void;
}

export interface SongCouncilContext {
  lessonId: string;
  chordKey: string;
  chordSymbol: string;
  attemptCount: number;
  // call this after each submit_audio to get advisor tip
  recordAttempt: (params: Omit<TipRequest, "lesson_id" | "chord_key" | "chord_symbol" | "attempt">) => Promise<TipResponse>;
}

export default function SongCouncil({ onPracticeChord }: SongCouncilProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lesson, setLesson] = useState<LessonDocument | null>(null);
  const [chordScores, setChordScores] = useState<Record<string, number>>({});
  const [allChordsAttempted, setAllChordsAttempted] = useState(false);
  const [revising, setRevising] = useState(false);
  // track attempt count per chord
  const [attemptCounts, setAttemptCounts] = useState<Record<string, number>>({});

  async function handleSearch(query: string) {
    setLoading(true);
    setError(null);
    setLesson(null);
    setChordScores({});
    setAllChordsAttempted(false);
    setAttemptCounts({});
    try {
      const doc = await generateSongLesson(query);
      setLesson(doc);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to generate lesson");
    } finally {
      setLoading(false);
    }
  }

  async function handleRevise() {
    if (!lesson) return;
    setRevising(true);
    try {
      const updated = await reviseSongLesson(lesson.lesson_id);
      setLesson(updated);
    } catch (e) {
      // silently fail — keep existing lesson
    } finally {
      setRevising(false);
    }
  }

  function handlePracticeChord(chordKey: string) {
    if (!lesson) return;
    const practiceChord = lesson.practice_chords.find((c) => c.chord_key === chordKey);
    if (!practiceChord) return;

    const currentAttempt = (attemptCounts[chordKey] ?? 0) + 1;

    const context: SongCouncilContext = {
      lessonId: lesson.lesson_id,
      chordKey,
      chordSymbol: practiceChord.symbol,
      attemptCount: currentAttempt,
      recordAttempt: async (params) => {
        const req: TipRequest = {
          lesson_id: lesson.lesson_id,
          chord_key: chordKey,
          chord_symbol: practiceChord.symbol,
          attempt: currentAttempt,
          ...params,
        };
        const resp = await getSongTip(req);

        // update scores in council state
        setAttemptCounts((prev) => ({ ...prev, [chordKey]: currentAttempt }));
        setChordScores((prev) => ({
          ...prev,
          [chordKey]: params.score,
        }));
        if (resp.all_chords_attempted) setAllChordsAttempted(true);
        return resp;
      },
    };

    onPracticeChord(chordKey, context);
  }

  return (
    <div className="w-full">
      <SongSearchBar onSearch={handleSearch} loading={loading} />
      <CouncilProgress active={loading} />

      {error && (
        <div
          className="mt-6 max-w-2xl mx-auto glass-card p-4 text-sm text-center"
          style={{ color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" }}
        >
          ⚠️ {error}
        </div>
      )}

      {lesson && !loading && (
        <div className="mt-8">
          <LessonDisplay
            lesson={lesson}
            chordScores={chordScores}
            allChordsAttempted={allChordsAttempted}
            revising={revising}
            onPracticeChord={handlePracticeChord}
            onRevise={handleRevise}
          />
        </div>
      )}
    </div>
  );
}
