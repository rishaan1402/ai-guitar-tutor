"use client";

import RichText from "@/components/ui/RichText";
import React, { useState, useEffect } from "react";
import { LessonDocument } from "@/lib/api";
import LessonSuiteNav, { Stage } from "./LessonSuiteNav";
import LessonQuiz from "./LessonQuiz";
import PracticeChordCard from "./PracticeChordCard";
import PlayAlongMode from "./PlayAlongMode";
import ChartStage from "./ChartStage";

interface LessonSuiteProps {
  lesson: LessonDocument;
  chordScores: Record<string, number>;
  chordScoreHistory: Record<string, number[]>;
  allChordsAttempted: boolean;
  revising: boolean;
  onPracticeChord: (chordKey: string) => void;
  onRevise: () => void;
}

// ---------------------------------------------------------------------------
// Collapsible section used inside Study stage
// ---------------------------------------------------------------------------

function Section({
  title,
  icon,
  content,
  defaultOpen = false,
}: {
  title: string;
  icon: string;
  content: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="glass-card overflow-hidden transition-all duration-300">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between p-4 text-left"
      >
        <span className="flex items-center gap-2 font-semibold text-sm">
          <span>{icon}</span>
          <span style={{ color: "rgb(var(--text))" }}>{title}</span>
        </span>
        <span
          className="text-xs transition-transform duration-200"
          style={{
            color: "rgb(var(--text) / 0.4)",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            display: "inline-block",
          }}
        >
          ▼
        </span>
      </button>
      {open && (
        <div
          className="px-4 pb-4 text-sm leading-relaxed fade-in-up"
          style={{ color: "rgb(var(--text) / 0.7)" }}
        >
          <RichText text={content} />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Study Stage
// ---------------------------------------------------------------------------

function StudyStage({
  lesson,
  onComplete,
}: {
  lesson: LessonDocument;
  onComplete: () => void;
}) {
  const difficultyColor =
    lesson.overall_difficulty === "beginner"
      ? "rgb(var(--ok-400))"
      : lesson.overall_difficulty === "intermediate"
      ? "rgb(var(--acc-400))"
      : "rgb(var(--live-400))";

  return (
    <div className="space-y-4 animate-stage-unlock">
      {/* Header */}
      <div className="glass-card p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="gradient-text text-2xl font-bold">{lesson.song_title}</h2>
            <p className="text-sm mt-1" style={{ color: "rgb(var(--text) / 0.5)" }}>
              {lesson.artist}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <span
              className="text-xs font-semibold px-3 py-1 rounded-full capitalize"
              style={{
                background: `color-mix(in srgb, ${difficultyColor} 13%, transparent)`,
                border: `1px solid color-mix(in srgb, ${difficultyColor} 33%, transparent)`,
                color: difficultyColor,
              }}
            >
              {lesson.overall_difficulty}
            </span>
            {lesson.key && (
              <span
                className="text-xs px-2 py-1 rounded-full"
                style={{
                  background: "rgba(var(--accent-rgb),0.15)",
                  border: "1px solid rgba(var(--accent-rgb),0.3)",
                  color: "rgba(var(--accent-soft-rgb),0.9)",
                }}
              >
                Key {lesson.key}
              </span>
            )}
            {lesson.time_signature && (
              <span
                className="text-xs px-2 py-1 rounded-full"
                style={{
                  background: "rgba(var(--sage-rgb),0.15)",
                  border: "1px solid rgba(var(--sage-rgb),0.3)",
                  color: "rgba(var(--sage-soft-rgb),0.9)",
                }}
              >
                {lesson.time_signature}
              </span>
            )}
            {lesson.tempo_feel && (
              <span
                className="text-xs px-2 py-1 rounded-full"
                style={{
                  background: "rgba(var(--sage-rgb),0.15)",
                  border: "1px solid rgba(var(--sage-rgb),0.3)",
                  color: "rgba(var(--sage-soft-rgb),0.9)",
                }}
              >
                {lesson.tempo_feel}
              </span>
            )}
          </div>
        </div>

        {/* Chairman summary */}
        <div
          className="mt-4 p-4 rounded-xl text-sm leading-relaxed"
          style={{
            background: "rgba(var(--accent-rgb),0.1)",
            border: "1px solid rgba(var(--accent-rgb),0.25)",
            color: "rgb(var(--text) / 0.8)",
                      }}
        >
          <RichText text={lesson.chairman_summary} />
        </div>

        {/* Song structure map */}
        {lesson.song_sections && lesson.song_sections.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1">
            <span className="text-xs mr-1" style={{ color: "rgb(var(--text) / 0.35)" }}>
              Structure:
            </span>
            {lesson.song_sections.map((section, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && (
                  <span style={{ color: "rgb(var(--text) / 0.2)", fontSize: "10px" }}>→</span>
                )}
                <span
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{
                    background: "rgb(var(--text) / 0.06)",
                    border: "1px solid rgb(var(--text) / 0.12)",
                    color: "rgb(var(--text) / 0.6)",
                  }}
                >
                  {section.name}
                </span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Collapsible specialist sections */}
      <Section title="Music Theory" icon="" content={lesson.theory_section} defaultOpen={true} />
      <Section title="Technique Guide" icon="" content={lesson.technique_section} />
      <Section title="Ear Training" icon="" content={lesson.ear_training_section} />

      {/* Mark studied button */}
      <div className="flex justify-center pt-2 pb-4">
        <button
          onClick={onComplete}
          className="btn-gradient px-8 py-3 rounded-xl font-semibold text-white text-sm transition-all duration-200"
          style={{ background: "linear-gradient(135deg, rgb(var(--acc-500)), rgb(var(--ok-500)))" }}
        >
          I&apos;ve studied this →
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Practice Stage
// ---------------------------------------------------------------------------

function PracticeStage({
  lesson,
  chordScores,
  chordScoreHistory,
  allChordsAttempted,
  revising,
  onPracticeChord,
  onRevise,
}: {
  lesson: LessonDocument;
  chordScores: Record<string, number>;
  chordScoreHistory: Record<string, number[]>;
  allChordsAttempted: boolean;
  revising: boolean;
  onPracticeChord: (chordKey: string) => void;
  onRevise: () => void;
}) {
  const available = lesson.practice_chords.filter((c) => c.available_in_app && c.chord_key);
  const attemptedCount = available.filter((c) => chordScores[c.chord_key!] != null).length;

  return (
    <div className="space-y-4 animate-stage-unlock">
      {/* Progress bar */}
      <div className="glass-card p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold" style={{ color: "rgb(var(--text) / 0.7)" }}>
            Chords to practise
          </span>
          <span className="text-xs" style={{ color: "rgb(var(--text) / 0.4)" }}>
            {attemptedCount}/{available.length} practiced
          </span>
        </div>

        {available.length > 0 && (
          <div
            className="w-full h-1.5 rounded-full mb-4 overflow-hidden"
            style={{ background: "rgb(var(--text) / 0.08)" }}
          >
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${(attemptedCount / available.length) * 100}%`,
                background: "linear-gradient(90deg, rgb(var(--acc-500)), rgb(var(--ok-500)))",
              }}
            />
          </div>
        )}

        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
          {lesson.practice_chords.map((chord) => (
            <PracticeChordCard
              key={chord.symbol}
              chord={chord}
              score={chord.chord_key ? chordScores[chord.chord_key] ?? null : null}
              scoreHistory={chord.chord_key ? chordScoreHistory[chord.chord_key] ?? [] : []}
              chordFunction={lesson.chord_functions?.[chord.symbol] ?? null}
              onPractice={onPracticeChord}
            />
          ))}
        </div>

        {allChordsAttempted && (
          <div
            className="mt-4 p-3 rounded-xl text-center text-sm font-medium animate-quiz-correct"
            style={{
              background: "rgb(var(--ok-400) / 0.1)",
              border: "1px solid rgb(var(--ok-400) / 0.3)",
              color: "rgb(var(--ok-200))",
            }}
          >
            Practice complete. Head to Perform when you&apos;re ready.
          </div>
        )}

        {allChordsAttempted && (
          <div className="mt-3 flex justify-center">
            <button
              onClick={onRevise}
              disabled={revising}
              className="btn-gradient px-6 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
            >
              {revising ? "Revising lesson…" : "Revise the practice plan"}
            </button>
          </div>
        )}
      </div>

      <Section title="Practice Plan" icon="" content={lesson.practice_plan} defaultOpen={true} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main LessonSuite
// ---------------------------------------------------------------------------

export default function LessonSuite({
  lesson,
  chordScores,
  chordScoreHistory,
  allChordsAttempted,
  revising,
  onPracticeChord,
  onRevise,
}: LessonSuiteProps) {
  const [stage, setStage] = useState<Stage>("study");
  const [completedStages, setCompletedStages] = useState<Set<Stage>>(new Set());

  // Auto-advance practice stage when all chords are done
  useEffect(() => {
    if (allChordsAttempted && !completedStages.has("practice")) {
      // Mark practice done but don't forcibly navigate away
      setCompletedStages((prev) => { const next = new Set(prev); next.add("practice"); return next; });
    }
  }, [allChordsAttempted, completedStages]);

  function completeStage(s: Stage) {
    setCompletedStages((prev) => { const next = new Set(prev); next.add(s); return next; });
    // Advance to next stage
    const order: Stage[] = ["study", "chart", "quiz", "practice", "perform"];
    const nextIdx = order.indexOf(s) + 1;
    if (nextIdx < order.length) {
      setStage(order[nextIdx]);
    }
  }

  return (
    <div className="w-full max-w-3xl mx-auto">
      <LessonSuiteNav
        stage={stage}
        completedStages={completedStages}
        onStageChange={setStage}
      />

      {stage === "study" && (
        <StudyStage
          lesson={lesson}
          onComplete={() => completeStage("study")}
        />
      )}

      {stage === "chart" && (
        <ChartStage
          lesson={lesson}
          onPracticeChord={onPracticeChord}
          onComplete={() => completeStage("chart")}
        />
      )}

      {stage === "quiz" && (
        <LessonQuiz
          lessonId={lesson.lesson_id}
          onPass={() => completeStage("quiz")}
          onSkip={() => completeStage("quiz")}
        />
      )}

      {stage === "practice" && (
        <PracticeStage
          lesson={lesson}
          chordScores={chordScores}
          chordScoreHistory={chordScoreHistory}
          allChordsAttempted={allChordsAttempted}
          revising={revising}
          onPracticeChord={onPracticeChord}
          onRevise={onRevise}
        />
      )}

      {stage === "perform" && (
        <PlayAlongMode
          lesson={lesson}
          onClose={() => setStage("practice")}
        />
      )}
    </div>
  );
}
