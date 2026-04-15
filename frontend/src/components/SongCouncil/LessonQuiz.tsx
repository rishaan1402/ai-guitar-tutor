"use client";

import React, { useState, useEffect } from "react";
import { getQuiz, QuizQuestion } from "@/lib/api";

interface LessonQuizProps {
  lessonId: string;
  onPass: () => void;
  onSkip: () => void;
}

export default function LessonQuiz({ lessonId, onPass, onSkip }: LessonQuizProps) {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [failCount, setFailCount] = useState(0);
  const [passed, setPassed] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    getQuiz(lessonId)
      .then((data) => {
        if (mounted) {
          setQuestions(data.questions);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (mounted) {
          setError(e instanceof Error ? e.message : "Failed to load quiz");
          setLoading(false);
        }
      });
    return () => { mounted = false; };
  }, [lessonId]);

  function selectAnswer(questionId: string, optionIndex: number) {
    if (submitted) return;
    setAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));
  }

  function handleSubmit() {
    if (questions.length === 0) return;
    const correct = questions.filter(
      (q) => answers[q.id] === q.correct_index
    ).length;
    const passed = correct >= Math.ceil(questions.length * 2 / 3);

    setSubmitted(true);

    if (passed) {
      setPassed(true);
      setTimeout(onPass, 1800);
    } else {
      setFailCount((c) => c + 1);
    }
  }

  function handleTryAgain() {
    setAnswers({});
    setSubmitted(false);
  }

  const allAnswered = questions.length > 0 && questions.every((q) => answers[q.id] !== undefined);

  // ---------------------------------------------------------------------------
  // Loading / error states
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="w-full max-w-2xl mx-auto py-12 flex flex-col items-center gap-4 fade-in-up">
        <div
          className="w-10 h-10 rounded-full border-2 animate-spin"
          style={{ borderColor: "rgba(124,58,237,0.3)", borderTopColor: "#7c3aed" }}
        />
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
          Generating quiz questions…
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full max-w-2xl mx-auto py-8 fade-in-up">
        <div
          className="glass-card p-6 text-center"
          style={{ border: "1px solid rgba(239,68,68,0.3)", color: "#f87171" }}
        >
          <p className="mb-4">⚠️ {error}</p>
          <button
            onClick={onSkip}
            className="btn-gradient px-5 py-2 rounded-xl text-sm font-semibold text-white"
          >
            Skip to Practice →
          </button>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Passed banner
  // ---------------------------------------------------------------------------

  if (passed) {
    return (
      <div className="w-full max-w-2xl mx-auto py-12 flex flex-col items-center gap-4 fade-in-up">
        <div
          className="glass-card p-8 text-center animate-quiz-correct"
          style={{ border: "1px solid rgba(34,197,94,0.4)" }}
        >
          <div className="text-4xl mb-3">🎉</div>
          <p className="text-lg font-bold" style={{ color: "#86efac" }}>
            Well done! Unlocking Practice…
          </p>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Quiz questions
  // ---------------------------------------------------------------------------

  const correctCount = submitted
    ? questions.filter((q) => answers[q.id] === q.correct_index).length
    : 0;

  return (
    <div className="w-full max-w-2xl mx-auto fade-in-up space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.7)" }}>
          🧠 Knowledge Check — {questions.length} Questions
        </h3>
        {submitted && (
          <span
            className="text-sm font-semibold px-3 py-1 rounded-full"
            style={{
              background: correctCount >= 2 ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
              border: `1px solid ${correctCount >= 2 ? "rgba(34,197,94,0.4)" : "rgba(239,68,68,0.4)"}`,
              color: correctCount >= 2 ? "#86efac" : "#f87171",
            }}
          >
            {correctCount}/{questions.length} correct
          </span>
        )}
      </div>

      {questions.map((q, qi) => {
        const userAnswer = answers[q.id];
        const isCorrect = submitted && userAnswer === q.correct_index;
        const isWrong = submitted && userAnswer !== undefined && userAnswer !== q.correct_index;

        return (
          <div
            key={q.id}
            className="glass-card space-y-3 animate-stage-unlock"
            style={{
              animationDelay: `${qi * 0.1}s`,
              border: submitted
                ? isCorrect
                  ? "1px solid rgba(34,197,94,0.5)"
                  : isWrong
                  ? "1px solid rgba(239,68,68,0.5)"
                  : "1px solid rgba(255,255,255,0.1)"
                : "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <p className="text-sm font-medium" style={{ color: "#e2e8f0" }}>
              {qi + 1}. {q.question}
            </p>

            <div className="space-y-2">
              {q.options.map((option, oi) => {
                const isSelected = userAnswer === oi;
                const isCorrectOption = submitted && oi === q.correct_index;
                const isWrongSelection = submitted && isSelected && oi !== q.correct_index;

                let optBg = "rgba(255,255,255,0.04)";
                let optBorder = "rgba(255,255,255,0.12)";
                let optColor = "rgba(255,255,255,0.7)";

                if (!submitted && isSelected) {
                  optBg = "rgba(124,58,237,0.25)";
                  optBorder = "rgba(124,58,237,0.6)";
                  optColor = "#c4b5fd";
                } else if (isCorrectOption) {
                  optBg = "rgba(34,197,94,0.15)";
                  optBorder = "rgba(34,197,94,0.5)";
                  optColor = "#86efac";
                } else if (isWrongSelection) {
                  optBg = "rgba(239,68,68,0.15)";
                  optBorder = "rgba(239,68,68,0.5)";
                  optColor = "#f87171";
                }

                return (
                  <button
                    key={oi}
                    onClick={() => selectAnswer(q.id, oi)}
                    disabled={submitted}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm transition-all duration-150"
                    style={{
                      background: optBg,
                      border: `1px solid ${optBorder}`,
                      color: optColor,
                      cursor: submitted ? "default" : "pointer",
                    }}
                  >
                    {option}
                    {isCorrectOption && " ✓"}
                    {isWrongSelection && " ✗"}
                  </button>
                );
              })}
            </div>

            {submitted && (
              <p
                className="text-xs leading-relaxed"
                style={{ color: "rgba(255,255,255,0.5)", fontStyle: "italic" }}
              >
                {q.explanation}
              </p>
            )}
          </div>
        );
      })}

      {/* Actions */}
      <div className="flex flex-wrap justify-center gap-3 pt-2">
        {!submitted ? (
          <button
            onClick={handleSubmit}
            disabled={!allAnswered}
            className="btn-gradient px-6 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-40"
          >
            Submit Answers
          </button>
        ) : correctCount < 2 ? (
          <>
            <button
              onClick={handleTryAgain}
              className="btn-gradient px-6 py-2 rounded-xl text-sm font-semibold text-white"
            >
              Try Again
            </button>
            {failCount >= 2 && (
              <button
                onClick={onSkip}
                className="px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-200"
                style={{
                  border: "1px solid rgba(255,255,255,0.2)",
                  color: "rgba(255,255,255,0.6)",
                  background: "rgba(255,255,255,0.05)",
                }}
              >
                Skip Quiz →
              </button>
            )}
          </>
        ) : null}
      </div>

      {failCount > 0 && !submitted && (
        <p
          className="text-center text-xs"
          style={{ color: "rgba(255,255,255,0.35)" }}
        >
          Attempt {failCount + 1} of 3
          {failCount >= 2 && " — skip available after submitting again"}
        </p>
      )}
    </div>
  );
}
