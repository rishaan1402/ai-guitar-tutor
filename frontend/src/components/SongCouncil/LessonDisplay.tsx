"use client";

import React, { useState } from "react";
import { LessonDocument, PracticeChord, TipResponse } from "@/lib/api";
import PracticeChordCard from "./PracticeChordCard";

interface LessonDisplayProps {
  lesson: LessonDocument;
  chordScores: Record<string, number>;
  chordScoreHistory?: Record<string, number[]>;
  allChordsAttempted: boolean;
  revising: boolean;
  onPracticeChord: (chordKey: string) => void;
  onRevise: () => void;
  onPlayAlong: () => void;
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
  chordScoreHistory = {},
  allChordsAttempted,
  revising,
  onPracticeChord,
  onRevise,
  onPlayAlong,
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
              <span className="text-xs px-2 py-1 rounded-full" style={{ background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.3)", color: "rgba(167,139,250,0.9)" }}>
                🎵 {lesson.key}
              </span>
            )}
            {lesson.time_signature && (
              <span className="text-xs px-2 py-1 rounded-full" style={{ background: "rgba(37,99,235,0.15)", border: "1px solid rgba(37,99,235,0.3)", color: "rgba(147,197,253,0.9)" }}>
                ⏱ {lesson.time_signature}
              </span>
            )}
            {lesson.tempo_feel && (
              <span className="text-xs px-2 py-1 rounded-full" style={{ background: "rgba(8,145,178,0.15)", border: "1px solid rgba(8,145,178,0.3)", color: "rgba(103,232,249,0.9)" }}>
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

        {/* Song structure map */}
        {lesson.song_sections && lesson.song_sections.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1">
            <span className="text-xs mr-1" style={{ color: "rgba(255,255,255,0.35)" }}>Structure:</span>
            {lesson.song_sections.map((section, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <span style={{ color: "rgba(255,255,255,0.2)", fontSize: "10px" }}>→</span>}
                <span
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    color: "rgba(255,255,255,0.6)",
                  }}
                >
                  {section.name}
                </span>
              </span>
            ))}
          </div>
        )}
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
              scoreHistory={chord.chord_key ? chordScoreHistory[chord.chord_key] ?? [] : []}
              chordFunction={lesson.chord_functions?.[chord.symbol] ?? null}
              onPractice={onPracticeChord}
            />
          ))}
        </div>

        {/* Play Along + Revise buttons */}
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          <button
            onClick={onPlayAlong}
            className="btn-gradient px-5 py-2 rounded-xl text-sm font-semibold text-white"
            style={{ background: "linear-gradient(135deg, #0891b2, #7c3aed)" }}
          >
            🎮 Play Along
          </button>
          {allChordsAttempted && (
            <button
              onClick={onRevise}
              disabled={revising}
              className="btn-gradient px-6 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
            >
              {revising ? "Revising lesson..." : "✨ Revise Lesson Plan"}
            </button>
          )}
        </div>
      </div>

      {/* Specialist sections */}
      <Section title="Music Theory" icon="🎼" content={lesson.theory_section} defaultOpen={true} />
      <Section title="Technique Guide" icon="✋" content={lesson.technique_section} />
      <Section title="Ear Training" icon="👂" content={lesson.ear_training_section} />
      <Section title="Practice Plan" icon="📅" content={lesson.practice_plan} />
    </div>
  );
}
