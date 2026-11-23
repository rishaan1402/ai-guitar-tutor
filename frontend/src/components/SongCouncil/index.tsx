"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  LessonDocument,
  generateSongLesson,
  getSongTip,
  resumeSongSession,
  reviseSongLesson,
  TipRequest,
  TipResponse,
} from "@/lib/api";
import SongSearchBar from "./SongSearchBar";
import CouncilProgress from "./CouncilProgress";
import { IntegratedLessonView } from "./IntegratedLessonView";
import SavedSongs from "./SavedSongs";
import { isSongSaved, loadCurrentSong, saveCurrentSong, saveSong, songKey, updateSavedSong, type SongWork } from "@/lib/songStore";
import { saveToAccount } from "@/lib/songLibrary";

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
    setSaved(isSongSaved(songKey(w.lesson)));
    revive(w.lesson);
  }

  /**
   * Practice sessions on the server end after 30 days unused. Reopening a song
   * picks its session back up, or starts a fresh one from the song library
   * (no new AI generation), so tips, quiz and revise keep working.
   */
  async function revive(l: LessonDocument) {
    if (!l.song_id) return; // lessons made before the song library: nothing to renew from
    try {
      const r = await resumeSongSession(l.song_id, l.lesson_id);
      setLesson((cur) => (cur && songKey(cur) === songKey(l) ? r.lesson : cur));
      if (r.resumed && Object.keys(r.chord_scores).length) setChordScoreHistory(r.chord_scores);
    } catch {
      /* offline or the song is gone: keep what we have on this device */
    }
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
    saveToAccount(lesson.song_id);
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
      setSaved(isSongSaved(songKey(doc)));
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

      {!loading && <SavedSongs currentId={lesson ? songKey(lesson) : null} onOpen={openSaved} />}
    </div>
  );
}
