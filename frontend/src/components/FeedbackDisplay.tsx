"use client";

import { useEffect, useRef, useState } from "react";
import ScoreRing from "./ScoreRing";
import Confetti from "./Confetti";
import { FretboardVisualizer } from "./feedback/FretboardVisualizer";
import { NoteDiffStrip } from "./feedback/NoteDiffStrip";
import { FingeringTipCard } from "./feedback/FingeringTipCard";
import type { ChordFingering } from "@/lib/api";
import { useReducedMotion } from "@/lib/motion";
import { isActivationKey, isInteractiveTarget } from "@/lib/hotkeys";

export interface Evaluation {
  score: number;
  detected_notes: string[];
  expected_notes: string[];
  missing_notes: string[];
  extra_notes?: string[];
  issue: string | null;
  tuning_cents?: number;
  tuning_warning?: boolean;
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
  sessionState: string;
  fingeringTips?: FingeringTip[];
  scoreHistory?: ScoreEntry[];
  analysis?: Analysis | null;
  fingering?: ChordFingering | null;
  /** Cents off concert pitch, from the submit response. */
  tuningCents?: number | null;
  tuningWarning?: boolean;
  /** Record another take of the same chord (FEEDBACK state). */
  onRetry?: () => void;
  /** Restart the same chord after it was completed. */
  onPlayAgain?: () => void;
  /** Move on to the suggested next chord. */
  onNext?: () => void;
  nextLabel?: string | null;
  busy?: boolean;
}

/** "+23% vs last take" style delta, or null for the first take. */
export function deltaVsLastTake(scoreHistory: ScoreEntry[]): string | null {
  if (scoreHistory.length < 2) return null;
  const prev = scoreHistory[scoreHistory.length - 2].score;
  const curr = scoreHistory[scoreHistory.length - 1].score;
  const diff = Math.round((curr - prev) * 100);
  if (diff > 0) return `+${diff}% vs last take`;
  if (diff === 0) return "Same as last take";
  return `${diff}% vs last take`;
}

export function tuningHint(cents: number): string {
  const n = Math.round(Math.abs(cents));
  return `Your guitar sounds ~${n} cents ${cents < 0 ? "flat" : "sharp"} — tune up for accurate grading.`;
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
  sessionState,
  fingeringTips,
  scoreHistory = [],
  analysis,
  fingering,
  tuningCents,
  tuningWarning,
  onRetry,
  onPlayAgain,
  onNext,
  nextLabel,
  busy,
}: Props) {
  const [speaking, setSpeaking] = useState(false);
  const reduceMotion = useReducedMotion();
  const isCompleted = sessionState === "COMPLETED";
  const primaryAction = isCompleted ? onPlayAgain : onRetry;
  const primaryRef = useRef(primaryAction);
  primaryRef.current = busy ? undefined : primaryAction;

  // Hands are on the guitar: Space / Enter = "go again".
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!isActivationKey(e) || isInteractiveTarget(e.target) || !primaryRef.current) return;
      e.preventDefault();
      primaryRef.current();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!feedback && !evaluation) return null;

  const delta = deltaVsLastTake(scoreHistory);
  const bestScore = scoreHistory.length > 0 ? Math.max(...scoreHistory.map((s) => s.score)) : null;
  const previousBest =
    scoreHistory.length > 1 ? Math.max(...scoreHistory.slice(0, -1).map((s) => s.score)) : undefined;
  const currentScore = evaluation?.score ?? 0;
  const pct = Math.round(currentScore * 100);
  const cents = tuningCents ?? evaluation?.tuning_cents ?? null;
  const showTuning = (tuningWarning ?? evaluation?.tuning_warning) && cents != null;

  return (
    <div className="glass-card space-y-5" style={{ animation: "fade-in-up 0.4s ease-out both" }}>
      <Confetti active={currentScore >= 0.8 && !reduceMotion} />

      {/* Screen readers get the result once, not every frame of the count-up */}
      <p className="sr-only" aria-live="polite" role="status">
        {evaluation ? `Score ${pct} percent. ` : ""}
        {isCompleted ? "Lesson complete. " : ""}
        {feedback ?? ""}
      </p>

      {/* Hero: score ring + the one sentence that matters */}
      <div className="flex flex-col sm:flex-row items-center gap-5 sm:gap-6">
        {evaluation && (
          <ScoreRing
            score={evaluation.score}
            size={140}
            strokeWidth={8}
            animate
            previousBest={previousBest}
          />
        )}
        <div className="flex-1 min-w-0 space-y-2 text-center sm:text-left">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
            {isCompleted ? "Lesson complete" : `Take ${scoreHistory.length || attempt}`}
            {bestScore !== null && scoreHistory.length > 1 && (
              <span className="normal-case tracking-normal font-medium">
                {" · "}best so far {Math.round(bestScore * 100)}%
              </span>
            )}
          </p>
          {feedback && (
            <div className="flex items-start gap-2 justify-center sm:justify-start">
              <p className="text-gray-100 text-base leading-relaxed">{feedback}</p>
              <button
                onClick={() => speakText(feedback, setSpeaking)}
                title={speaking ? "Stop reading" : "Read aloud"}
                aria-label={speaking ? "Stop reading feedback" : "Read feedback aloud"}
                className="shrink-0 mt-0.5 rounded-lg px-2 py-1 text-sm transition-all duration-200"
                style={{
                  background: speaking ? "rgba(var(--accent-rgb),0.2)" : "rgba(255,255,255,0.06)",
                  border: speaking ? "1px solid rgba(var(--accent-rgb),0.5)" : "1px solid rgba(255,255,255,0.1)",
                  color: speaking ? "#efc27a" : "rgba(255,255,255,0.5)",
                }}
              >
                {speaking ? "⏹" : "🔊"}
              </button>
            </div>
          )}
          {delta && (
            <span
              className={`inline-block text-xs px-2 py-0.5 rounded-full border ${
                delta.startsWith("+")
                  ? "bg-green-500/10 text-green-300 border-green-500/20"
                  : delta.startsWith("-")
                  ? "bg-red-500/10 text-red-300 border-red-500/20"
                  : "bg-white/5 text-gray-400 border-white/10"
              }`}
            >
              {delta}
            </span>
          )}
          {showTuning && (
            <p
              className="text-xs text-amber-300/90 rounded-lg border border-amber-400/25 bg-amber-400/5 px-2.5 py-1.5"
              data-testid="tuning-hint"
            >
              {tuningHint(cents as number)}
            </p>
          )}
        </div>
      </div>

      {/* One primary action, one secondary */}
      <div className="flex flex-col sm:flex-row items-center gap-3 border-t border-white/10 pt-4">
        {isCompleted ? (
          <>
            {onPlayAgain && (
              <button
                onClick={onPlayAgain}
                disabled={busy}
                className="btn-gradient w-full sm:w-auto px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
              >
                Play it again
              </button>
            )}
            {onNext && (
              <button
                onClick={onNext}
                disabled={busy}
                className="glass w-full sm:w-auto px-5 py-2.5 rounded-xl text-sm font-semibold text-amber-200 border border-amber-400/30 hover:bg-amber-400/10 transition-colors disabled:opacity-50"
              >
                {nextLabel ? `Next: ${nextLabel} →` : "Next suggested chord →"}
              </button>
            )}
          </>
        ) : (
          <>
            {onRetry && (
              <button
                onClick={onRetry}
                disabled={busy}
                className="btn-gradient w-full sm:w-auto px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
              >
                Try again
              </button>
            )}
            {onNext && currentScore >= 0.5 && (
              <button
                onClick={onNext}
                disabled={busy}
                className="text-sm text-gray-400 hover:text-amber-200 underline-offset-4 hover:underline transition-colors"
              >
                {nextLabel ? `Move on to ${nextLabel} →` : "Next suggested chord →"}
              </button>
            )}
          </>
        )}
        <span className="hidden sm:inline text-xs text-gray-500 sm:ml-auto">
          Space = {isCompleted ? "play it again" : "try again"}
        </span>
      </div>

      {/* Analysis */}
      {analysis && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">What the engine heard</h4>
          <div className="glass rounded-xl p-3 border border-white/5 space-y-1.5">
            <p className="text-gray-300 text-sm">{analysis.heard}</p>
            <p className="text-gray-300 text-sm">{analysis.match}</p>
            {analysis.issue_detail && <p className="text-yellow-300/90 text-sm">{analysis.issue_detail}</p>}
            {analysis.extra_detail && <p className="text-orange-300/80 text-xs">{analysis.extra_detail}</p>}
          </div>
        </div>
      )}

      {evaluation && fingering && (
        <FretboardVisualizer
          fingering={fingering}
          detectedNotes={evaluation.detected_notes}
          missingNotes={evaluation.missing_notes}
          extraNotes={evaluation.extra_notes || []}
        />
      )}

      {/* Single note comparison (expected / detected / missing) */}
      {evaluation && (
        <NoteDiffStrip
          expectedNotes={evaluation.expected_notes}
          detectedNotes={evaluation.detected_notes}
          missingNotes={evaluation.missing_notes}
          extraNotes={evaluation.extra_notes}
        />
      )}

      {/* Score trend */}
      {scoreHistory.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500">Takes:</span>
          {scoreHistory.map((entry, i) => (
            <span key={i} className="flex items-center gap-1">
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
    </div>
  );
}
