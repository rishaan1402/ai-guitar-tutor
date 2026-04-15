"use client";

import React, { useState } from "react";
import { LessonDocument, PracticeChord, TipResponse } from "@/lib/api";
import PracticeChordCard from "./PracticeChordCard";

interface LessonDisplayProps {
  lesson: LessonDocument;
  chordScores: Record<string, number>;
  allChordsAttempted: boolean;
  revising: boolean;
  onPracticeChord: (chordKey: string) => void;
  onRevise: () => void;
}

interface SectionProps {
  title: string;
  icon: string;
  content: string;
  defaultOpen?: boolean;
}

function Section({ title, icon, content, defaultOpen = false }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="glass-card overflow-hidden transition-all duration-300">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between p-4 text-left"
      >
        <span className="flex items-center gap-2 font-semibold text-sm">
          <span>{icon}</span>
          <span style={{ color: "#e2e8f0" }}>{title}</span>
        </span>
        <span
          className="text-xs transition-transform duration-200"
          style={{
            color: "rgba(255,255,255,0.4)",
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
          style={{ color: "rgba(255,255,255,0.7)", whiteSpace: "pre-wrap" }}
        >
          {content}
        </div>
      )}
    </div>
  );
}

export default function LessonDisplay({
  lesson,
  chordScores,
  allChordsAttempted,
  revising,
  onPracticeChord,
  onRevise,
}: LessonDisplayProps) {
  const difficultyColor =
    lesson.overall_difficulty === "beginner"
      ? "#22c55e"
      : lesson.overall_difficulty === "intermediate"
      ? "#eab308"
      : "#ef4444";

  return (
    <div className="w-full max-w-3xl mx-auto fade-in-up space-y-4">
      {/* Header */}
      <div className="glass-card p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="gradient-text text-2xl font-bold">{lesson.song_title}</h2>
            <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.5)" }}>
              {lesson.artist}
            </p>
          </div>
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
      </div>

      {/* Practice chords */}
      <div className="glass-card p-4">
        <h3 className="text-sm font-semibold mb-3" style={{ color: "rgba(255,255,255,0.7)" }}>
          🎸 Chords to Practice
        </h3>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
          {lesson.practice_chords.map((chord) => (
            <PracticeChordCard
              key={chord.symbol}
              chord={chord}
              score={chord.chord_key ? chordScores[chord.chord_key] ?? null : null}
              onPractice={onPracticeChord}
            />
          ))}
        </div>

        {/* Revise button */}
        {allChordsAttempted && (
          <div className="mt-4 flex justify-center">
            <button
              onClick={onRevise}
              disabled={revising}
              className="btn-gradient px-6 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
            >
              {revising ? "Revising lesson..." : "✨ Revise Lesson Plan"}
            </button>
          </div>
        )}
      </div>

      {/* Specialist sections */}
      <Section title="Music Theory" icon="🎼" content={lesson.theory_section} defaultOpen={true} />
      <Section title="Technique Guide" icon="✋" content={lesson.technique_section} />
      <Section title="Ear Training" icon="👂" content={lesson.ear_training_section} />
      <Section title="Practice Plan" icon="📅" content={lesson.practice_plan} />
    </div>
  );
}
