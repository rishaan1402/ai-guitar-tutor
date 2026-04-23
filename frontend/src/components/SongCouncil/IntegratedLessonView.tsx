"use client";

import React, { useState, useRef, useEffect } from "react";
import { LessonDocument } from "@/lib/api";
import { SongTimeline } from "./SongTimeline";
import { ChordMasteryBoard } from "./ChordMasteryBoard";
import { LessonSection } from "./LessonSection";
import LessonQuiz from "./LessonQuiz";
import PlayAlongMode from "./PlayAlongMode";
import { ChordPracticeDrawer } from "./ChordPracticeDrawer";
import { SongCouncilContext } from "./index";

interface IntegratedLessonViewProps {
  lesson: LessonDocument;
  chordScores: Record<string, number>;
  chordScoreHistory: Record<string, number[]>;
  allChordsAttempted: boolean;
  revising: boolean;
  onPracticeChord: (chordKey: string, context: SongCouncilContext) => void;
  onRevise: () => void;
}

/**
 * Single scrollable lesson surface with deep-linkable anchors
 * Replaces tab-switching navigation with unified interactive experience
 */
export function IntegratedLessonView({
  lesson,
  chordScores,
  chordScoreHistory,
  allChordsAttempted,
  revising,
  onPracticeChord,
  onRevise,
}: IntegratedLessonViewProps) {
  const [showChordDrawer, setShowChordDrawer] = useState(false);
  const [selectedChordKey, setSelectedChordKey] = useState<string | null>(null);
  const [showQuiz, setShowQuiz] = useState(false);
  const [showPlayAlong, setShowPlayAlong] = useState(false);
  const [quizPassed, setQuizPassed] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [highlightedChords, setHighlightedChords] = useState<string[]>([]);

  const headerRef = useRef<HTMLDivElement>(null);
  const theoryRef = useRef<HTMLDivElement>(null);
  const chordBoardRef = useRef<HTMLDivElement>(null);
  const quizRef = useRef<HTMLDivElement>(null);

  const difficultyColor =
    lesson.overall_difficulty === "beginner"
      ? "#22c55e"
      : lesson.overall_difficulty === "intermediate"
      ? "#eab308"
      : "#ef4444";

  // Get context for selected chord
  const selectedContext: SongCouncilContext | null = selectedChordKey
    ? {
        lessonId: lesson.lesson_id,
        chordKey: selectedChordKey,
        chordSymbol:
          lesson.practice_chords.find((c) => c.chord_key === selectedChordKey)?.symbol || "",
        attemptCount: 1,
        recordAttempt: async (params) => {
          // This will be called by the parent
          return { tip: "", all_chords_attempted: false, chord_scores: {} };
        },
      }
    : null;

  const handlePracticeChord = (chordKey: string) => {
    setSelectedChordKey(chordKey);
    setShowChordDrawer(true);
  };

  const handleScrollToSection = (sectionName: string) => {
    // Find the section and its chords
    const section = lesson.song_sections?.find((s) => s.name === sectionName);

    // Toggle off if clicking same section
    if (activeSection === sectionName) {
      setActiveSection(null);
      setHighlightedChords([]);
      return;
    }

    setActiveSection(sectionName);

    // Map section chord symbols → chord_keys for highlighting
    if (section?.chords) {
      const keys = section.chords
        .map((sym) => lesson.practice_chords.find((pc) => pc.symbol === sym)?.chord_key)
        .filter((k): k is string => !!k);
      setHighlightedChords(keys);
    } else {
      setHighlightedChords([]);
    }

    // Scroll to chord board
    chordBoardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Song Header */}
      <div ref={headerRef} className="glass-card p-6 scroll-mt-20" id="header">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="gradient-text text-3xl font-bold">{lesson.song_title}</h2>
            <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.5)" }}>
              {lesson.artist}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <span
              className="text-xs font-semibold px-3 py-1 rounded-full capitalize"
              style={{
                background: `${difficultyColor}22`,
                border: `1px solid ${difficultyColor}55`,
                color: difficultyColor,
              }}
            >
              {lesson.overall_difficulty}
            </span>
            {lesson.key && (
              <span
                className="text-xs px-2 py-1 rounded-full"
                style={{
                  background: "rgba(124,58,237,0.15)",
                  border: "1px solid rgba(124,58,237,0.3)",
                  color: "rgba(167,139,250,0.9)",
                }}
              >
                🎵 {lesson.key}
              </span>
            )}
            {lesson.time_signature && (
              <span
                className="text-xs px-2 py-1 rounded-full"
                style={{
                  background: "rgba(37,99,235,0.15)",
                  border: "1px solid rgba(37,99,235,0.3)",
                  color: "rgba(147,197,253,0.9)",
                }}
              >
                ⏱ {lesson.time_signature}
              </span>
            )}
            {lesson.tempo_feel && (
              <span
                className="text-xs px-2 py-1 rounded-full"
                style={{
                  background: "rgba(8,145,178,0.15)",
                  border: "1px solid rgba(8,145,178,0.3)",
                  color: "rgba(103,232,249,0.9)",
                }}
              >
                🎸 {lesson.tempo_feel}
              </span>
            )}
          </div>
        </div>

        {/* Chairman summary */}
        <div
          className="mt-4 p-4 rounded-xl text-sm leading-relaxed"
          style={{
            background: "rgba(124,58,237,0.1)",
            border: "1px solid rgba(124,58,237,0.25)",
            color: "rgba(255,255,255,0.8)",
            whiteSpace: "pre-wrap",
          }}
        >
          {lesson.chairman_summary}
        </div>

        {/* Song structure timeline */}
        {lesson.song_sections && lesson.song_sections.length > 0 && (
          <div className="mt-4">
            <p className="text-xs text-gray-400 uppercase font-mono mb-2">Structure</p>
            <SongTimeline
              lesson={lesson}
              chordScores={chordScores}
              activeSection={activeSection}
              onSectionClick={handleScrollToSection}
            />
          </div>
        )}
      </div>

      {/* Theory + Technique + Ear sections */}
      <div className="space-y-3">
        <LessonSection
          title="Music Theory"
          icon="🎼"
          content={lesson.theory_section}
          defaultOpen={true}
        />
        <LessonSection
          title="Technique Guide"
          icon="✋"
          content={lesson.technique_section}
          defaultOpen={false}
        />
        <LessonSection
          title="Ear Training"
          icon="👂"
          content={lesson.ear_training_section}
          defaultOpen={false}
        />
      </div>

      {/* Chord Mastery Board */}
      <div ref={chordBoardRef} className="space-y-4 scroll-mt-20" id="chords">
        <ChordMasteryBoard
          lesson={lesson}
          chordScores={chordScores}
          chordScoreHistory={chordScoreHistory}
          highlightedChords={highlightedChords}
          activeSection={activeSection}
          onPracticeChord={handlePracticeChord}
        />

        {allChordsAttempted && (
          <div className="space-y-3">
            <div
              className="p-4 rounded-xl text-center text-sm font-medium"
              style={{
                background: "rgba(34,197,94,0.1)",
                border: "1px solid rgba(34,197,94,0.3)",
                color: "#86efac",
              }}
            >
              🎉 All chords practiced! Take the quiz or jump to play-along.
            </div>

            <button
              onClick={() => setShowQuiz(!showQuiz)}
              className="btn-gradient w-full px-6 py-3 rounded-xl font-semibold text-white"
            >
              {showQuiz ? "Hide Quiz" : "Take Quiz"}
            </button>

            {allChordsAttempted && (
              <button
                onClick={onRevise}
                disabled={revising}
                className="w-full px-6 py-3 rounded-xl font-semibold text-white disabled:opacity-50"
                style={{
                  background: "rgba(167,139,250,0.1)",
                  border: "1px solid rgba(167,139,250,0.3)",
                  color: "rgba(196,181,253,0.9)",
                }}
              >
                {revising ? "Revising lesson…" : "✨ Revise Lesson Plan"}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Practice Plan section */}
      <LessonSection
        title="Practice Plan"
        icon="📅"
        content={lesson.practice_plan}
        defaultOpen={false}
      />

      {/* Quiz Section */}
      {showQuiz && (
        <div ref={quizRef} className="scroll-mt-20" id="quiz">
          <LessonQuiz
            lessonId={lesson.lesson_id}
            onPass={() => {
              setQuizPassed(true);
              setShowQuiz(false);
            }}
            onSkip={() => setShowQuiz(false)}
          />
        </div>
      )}

      {/* Play Along Section */}
      {quizPassed && (
        <div className="space-y-4">
          <button
            onClick={() => setShowPlayAlong(!showPlayAlong)}
            className="btn-gradient w-full px-6 py-3 rounded-xl font-semibold text-white"
          >
            {showPlayAlong ? "Hide Play-Along" : "🎸 Play Along"}
          </button>

          {showPlayAlong && (
            <PlayAlongMode
              lesson={lesson}
              onClose={() => setShowPlayAlong(false)}
            />
          )}
        </div>
      )}

      {/* Chord Practice Drawer */}
      <ChordPracticeDrawer
        isOpen={showChordDrawer}
        onClose={() => setShowChordDrawer(false)}
        context={selectedContext}
        onPracticeChord={onPracticeChord}
      />
    </div>
  );
}
