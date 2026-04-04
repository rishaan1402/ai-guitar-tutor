"use client";

import NoteComparisonBar from "./NoteComparisonBar";
import ScoreRing from "./ScoreRing";
import Confetti from "./Confetti";

interface Evaluation {
  score: number;
  detected_notes: string[];
  expected_notes: string[];
  missing_notes: string[];
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

export default function FeedbackDisplay({
  feedback,
  evaluation,
  attempt,
  attemptsRemaining,
  sessionState,
  fingeringTips,
  scoreHistory,
  analysis,
}: Props) {
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
          <p className="text-gray-200 text-sm leading-relaxed">{feedback}</p>
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

      {/* Fingering tips */}
      {fingeringTips && fingeringTips.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Fix These</h4>
          <div className="space-y-1.5">
            {fingeringTips.map((tip) => (
              <div
                key={tip.note}
                className="glass flex items-center gap-2 text-xs rounded-xl px-3 py-2 border border-white/5"
              >
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-500/20 text-red-300 text-[10px] font-bold shrink-0 border border-red-500/30">
                  {tip.note}
                </span>
                <span className="text-gray-300">{tip.tip}</span>
              </div>
            ))}
          </div>
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
