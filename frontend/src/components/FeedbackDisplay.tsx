"use client";

import { useState } from "react";
import NoteComparisonBar from "./NoteComparisonBar";
import ScoreRing from "./ScoreRing";
import Confetti from "./Confetti";
import { FretboardVisualizer } from "./feedback/FretboardVisualizer";
import { NoteDiffStrip } from "./feedback/NoteDiffStrip";
import { FingeringTipCard } from "./feedback/FingeringTipCard";
import type { ChordFingering } from "@/lib/api";

interface Evaluation {
  score: number;
  detected_notes: string[];
  expected_notes: string[];
  missing_notes: string[];
  extra_notes?: string[];
  issue: string | null;
}

interface FingeringTip {
  note: string;
  string: number;
  fret: number;
  finger?: number | null;
  tip: string;
}

interface ScoreEntry {
  attempt: number;
  score: number;
}

interface Analysis {
  heard: string;
  match: string;
  issue_detail: string | null;
  extra_detail: string | null;
  matched_count: number;
  total_expected: number;
  total_detected: number;
}

interface Props {
  feedback: string | null;
  evaluation: Evaluation | null;
  attempt: number;
  attemptsRemaining?: number;
  sessionState: string;
  fingeringTips?: FingeringTip[];
  scoreHistory?: ScoreEntry[];
  analysis?: Analysis | null;
  fingering?: ChordFingering | null;
  skillLevel?: string;
  onRetry?: () => void;
  onMoveOn?: () => void;
  onMarkMastered?: () => void;
}

function getProgressionMessage(scoreHistory: ScoreEntry[]): string | null {
  if (scoreHistory.length < 2) return null;
  const prev = scoreHistory[scoreHistory.length - 2].score;
  const curr = scoreHistory[scoreHistory.length - 1].score;
  const diff = Math.round((curr - prev) * 100);

  if (diff > 0) return `+${diff}% from last attempt`;
  if (diff === 0) return "Same as last attempt";
  return `${diff}% from last attempt`;
}

function speakText(text: string, setSpeaking: (v: boolean) => void) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  if (window.speechSynthesis.speaking) {
    window.speechSynthesis.cancel();
    setSpeaking(false);
    return;
  }
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.9;
  utterance.onend = () => setSpeaking(false);
  utterance.onerror = () => setSpeaking(false);
  window.speechSynthesis.speak(utterance);
  setSpeaking(true);
}

export default function FeedbackDisplay({
  feedback,
  evaluation,
  attempt,
  attemptsRemaining,
  sessionState,
  fingeringTips,
  scoreHistory,
  analysis,
  fingering,
  skillLevel = "intermediate",
  onRetry,
  onMoveOn,
  onMarkMastered,
}: Props) {
  const [speaking, setSpeaking] = useState(false);
  const [hoveredNote, setHoveredNote] = useState<string | null>(null);

  if (!feedback && !evaluation) return null;

  const progressionMsg = scoreHistory ? getProgressionMessage(scoreHistory) : null;
  const isCompleted = sessionState === "COMPLETED";
  const bestScore = scoreHistory && scoreHistory.length > 0
    ? Math.max(...scoreHistory.map((s) => s.score))
    : null;
  const previousBest = scoreHistory && scoreHistory.length > 1
    ? Math.max(...scoreHistory.slice(0, -1).map((s) => s.score))
    : undefined;
  const currentScore = evaluation?.score ?? 0;
  const showConfetti = currentScore >= 0.8;

  return (
    <div className="glass-card space-y-5" style={{ animation: "fade-in-up 0.4s ease-out both" }}>
      <Confetti active={showConfetti} />

      {/* Header: title + score ring + attempt badge */}
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-lg font-semibold gradient-text">Feedback</h3>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-gray-500">Attempt #{attempt}</span>
            {progressionMsg && (
              <span
                className={`text-xs px-2 py-0.5 rounded-full border ${
                  progressionMsg.startsWith("+")
                    ? "bg-green-500/10 text-green-300 border-green-500/20"
                    : progressionMsg.startsWith("-")
                    ? "bg-red-500/10 text-red-300 border-red-500/20"
                    : "bg-white/5 text-gray-400 border-white/10"
                }`}
              >
                {progressionMsg}
              </span>
            )}
          </div>
        </div>

        {evaluation && (
          <ScoreRing
            score={evaluation.score}
            size={72}
            strokeWidth={6}
            animate
            previousBest={previousBest}
          />
        )}
      </div>

      {/* Tutor feedback text */}
      {feedback && (
        <div className="glass rounded-xl p-3 border border-white/5">
          <div className="flex items-start justify-between gap-2">
            <p className="text-gray-200 text-sm leading-relaxed flex-1">{feedback}</p>
            <button
              onClick={() => speakText(feedback, setSpeaking)}
              title={speaking ? "Stop reading" : "Read aloud"}
              className="shrink-0 mt-0.5 rounded-lg px-2 py-1 text-sm transition-all duration-200"
              style={{
                background: speaking ? "rgba(124,58,237,0.2)" : "rgba(255,255,255,0.06)",
                border: speaking ? "1px solid rgba(124,58,237,0.5)" : "1px solid rgba(255,255,255,0.1)",
                color: speaking ? "#a78bfa" : "rgba(255,255,255,0.5)",
              }}
            >
              {speaking ? "⏹" : "🔊"}
            </button>
          </div>
        </div>
      )}

      {/* Analysis */}
      {analysis && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Engine Analysis</h4>
          <div className="glass rounded-xl p-3 border border-white/5 space-y-1.5">
            <p className="text-gray-300 text-sm">{analysis.heard}</p>
            <p className="text-gray-300 text-sm">{analysis.match}</p>
            {analysis.issue_detail && (
              <p className="text-yellow-300/90 text-sm">{analysis.issue_detail}</p>
            )}
            {analysis.extra_detail && (
              <p className="text-orange-300/80 text-xs">{analysis.extra_detail}</p>
            )}
          </div>
        </div>
      )}

      {/* Note comparison pills */}
      {evaluation && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Expected Notes</h4>
          <NoteComparisonBar
            expectedNotes={evaluation.expected_notes}
            detectedNotes={evaluation.detected_notes}
            missingNotes={evaluation.missing_notes}
          />
        </div>
      )}

      {/* Score trend */}
      {scoreHistory && scoreHistory.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500">Trend:</span>
          {scoreHistory.map((entry, i) => (
            <span key={entry.attempt} className="flex items-center gap-1">
              {i > 0 && <span className="text-gray-600 text-xs">→</span>}
              <span
                className={`text-xs px-2 py-0.5 rounded-full border ${
                  entry.score >= 0.8
                    ? "bg-green-500/10 text-green-300 border-green-500/20"
                    : entry.score >= 0.5
                    ? "bg-yellow-500/10 text-yellow-300 border-yellow-500/20"
                    : "bg-red-500/10 text-red-300 border-red-500/20"
                }`}
              >
                {Math.round(entry.score * 100)}%
              </span>
            </span>
          ))}
        </div>
      )}

      {/* Fretboard visualizer */}
      {evaluation && fingering && (
        <div>
          <FretboardVisualizer
            fingering={fingering}
            detectedNotes={evaluation.detected_notes}
            missingNotes={evaluation.missing_notes}
            extraNotes={evaluation.extra_notes || []}
          />
        </div>
      )}

      {/* Note diff strip */}
      {evaluation && (
        <div>
          <NoteDiffStrip
            expectedNotes={evaluation.expected_notes}
            detectedNotes={evaluation.detected_notes}
            missingNotes={evaluation.missing_notes}
            extraNotes={evaluation.extra_notes}
            onNoteHover={setHoveredNote}
          />
        </div>
      )}

      {/* Enhanced fingering tips */}
      {fingeringTips && fingeringTips.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Fingering Tips</h4>
          <div className="space-y-2">
            {fingeringTips.map((tip) => (
              <FingeringTipCard
                key={tip.note}
                note={tip.note}
                string={tip.string}
                fret={tip.fret}
                finger={tip.finger}
                tip={tip.tip}
              />
            ))}
          </div>
        </div>
      )}

      {/* Next action bar */}
      {!isCompleted && evaluation && (
        <div className="border-t border-gray-700 pt-4 space-y-3">
          {currentScore < 0.7 ? (
            <div className="space-y-2">
              <p className="text-xs text-gray-400">
                {skillLevel === "beginner"
                  ? "Keep practicing! You're building muscle memory."
                  : "There's still room for improvement. Try again!"}
              </p>
              <button
                onClick={onRetry}
                className="w-full px-4 py-2 rounded-lg font-semibold text-white transition-all"
                style={{
                  background: "linear-gradient(135deg, #7c3aed, #0891b2)",
                }}
              >
                🎸 Retry This Chord
              </button>
            </div>
          ) : currentScore >= 0.9 ? (
            <div className="space-y-2">
              <p className="text-xs text-gray-400">
                {skillLevel === "advanced"
                  ? "Excellent execution. Ready for more complexity?"
                  : "Great work! You've mastered this one."}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={onMarkMastered}
                  className="px-4 py-2 rounded-lg font-semibold text-white"
                  style={{
                    background: "rgba(34,197,94,0.2)",
                    border: "1px solid rgba(34,197,94,0.5)",
                    color: "#86efac",
                  }}
                >
                  ✅ Mastered
                </button>
                <button
                  onClick={onMoveOn}
                  className="px-4 py-2 rounded-lg font-semibold text-white"
                  style={{
                    background: "linear-gradient(135deg, #7c3aed, #0891b2)",
                  }}
                >
                  → Next
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-gray-400">
                {skillLevel === "beginner"
                  ? "Nice progress! Keep practicing for consistency."
                  : "Good progress. Ready to move on?"}
              </p>
              <button
                onClick={onMoveOn}
                className="w-full px-4 py-2 rounded-lg font-semibold text-white transition-all"
                style={{
                  background: "linear-gradient(135deg, #7c3aed, #0891b2)",
                }}
              >
                → Move On
              </button>
            </div>
          )}
        </div>
      )}

      {/* Attempts remaining */}
      {attemptsRemaining !== undefined && attemptsRemaining > 0 && (
        <p className="text-xs text-gray-500">
          {attemptsRemaining} attempt{attemptsRemaining > 1 ? "s" : ""} remaining
        </p>
      )}

      {/* Completion summary */}
      {isCompleted && (
        <div
          className="rounded-xl p-4 border border-purple-500/30 space-y-1"
          style={{
            background: "linear-gradient(135deg, rgba(139,92,246,0.1), rgba(56,189,248,0.1))",
            animation: "pulse-glow 2s ease-in-out infinite",
          }}
        >
          <p className="font-bold gradient-text text-base">Lesson Complete!</p>
          {bestScore !== null && (
            <p className="text-sm text-gray-200">
              Best: <span className="font-bold">{Math.round(bestScore * 100)}%</span>
              {" · "}Attempts: {scoreHistory?.length || attempt}
            </p>
          )}
          <p className="text-xs text-gray-400">Select another chord to keep practicing.</p>
        </div>
      )}
    </div>
  );
}
