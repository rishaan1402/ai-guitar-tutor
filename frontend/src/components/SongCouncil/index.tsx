"use client";

import React, { useEffect, useRef, useState } from "react";
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
import { IntegratedLessonView } from "./IntegratedLessonView";
import SavedSongs from "./SavedSongs";
import { isSongSaved, loadCurrentSong, saveCurrentSong, saveSong, updateSavedSong, type SongWork } from "@/lib/songStore";

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
  const [chordScoreHistory, setChordScoreHistory] = useState<Record<string, number[]>>({});
  const [allChordsAttempted, setAllChordsAttempted] = useState(false);
  const [revising, setRevising] = useState(false);
  // track attempt count per chord
  const [attemptCounts, setAttemptCounts] = useState<Record<string, number>>({});
  const [saved, setSaved] = useState(false);

  // the song in progress comes back when you return to this page
  const restored = useRef(false);
  useEffect(() => {
    const w = loadCurrentSong();
    if (w?.lesson?.lesson_id) restore(w);
    restored.current = true;
  }, []);

  function restore(w: SongWork) {
    setLesson(w.lesson);
    setChordScores(w.chordScores ?? {});
    setChordScoreHistory(w.chordScoreHistory ?? {});
    setAllChordsAttempted(!!w.allChordsAttempted);
    setAttemptCounts(w.attemptCounts ?? {});
    setSaved(isSongSaved(w.lesson.lesson_id));
  }

  // keep it, and a saved copy, up to date as you practise
  useEffect(() => {
    if (!restored.current || !lesson) return;
    const w: SongWork = { lesson, chordScores, chordScoreHistory, allChordsAttempted, attemptCounts };
    saveCurrentSong(w);
    updateSavedSong(w);
  }, [lesson, chordScores, chordScoreHistory, allChordsAttempted, attemptCounts]);

  function handleSave() {
    if (!lesson) return;
    saveSong({ lesson, chordScores, chordScoreHistory, allChordsAttempted, attemptCounts });
    setSaved(true);
  }

  function openSaved(w: SongWork) {
    restore(w);
    saveCurrentSong(w);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSearch(query: string) {
    setLoading(true);
    setError(null);
    setLesson(null);
    setChordScores({});
    setChordScoreHistory({});
    setAllChordsAttempted(false);
    setAttemptCounts({});
    setSaved(false);
    saveCurrentSong(null);
    try {
      const doc = await generateSongLesson(query);
      setLesson(doc);
      setSaved(isSongSaved(doc.lesson_id));
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
    } catch {
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
        // store full attempt history for sparklines
        if (resp.chord_scores) {
          setChordScoreHistory(resp.chord_scores);
        }
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
          style={{ color: "rgb(var(--live-300))", border: "1px solid rgba(var(--amp-rgb),0.3)" }}
        >
          ⚠️ {error}
        </div>
      )}

      {lesson && !loading && (
        <div className="mt-8">
          <IntegratedLessonView
            lesson={lesson}
            chordScores={chordScores}
            chordScoreHistory={chordScoreHistory}
            allChordsAttempted={allChordsAttempted}
            revising={revising}
            onPracticeChord={handlePracticeChord}
            onRevise={handleRevise}
            saved={saved}
            onSave={handleSave}
          />
        </div>
      )}

      {!loading && <SavedSongs currentId={lesson?.lesson_id ?? null} onOpen={openSaved} />}
    </div>
  );
}
