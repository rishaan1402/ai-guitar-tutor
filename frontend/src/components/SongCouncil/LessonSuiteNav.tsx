"use client";

import React from "react";

export type Stage = "study" | "quiz" | "practice" | "perform";

interface LessonSuiteNavProps {
  stage: Stage;
  completedStages: Set<Stage>;
  onStageChange: (s: Stage) => void;
}

const STAGES: { key: Stage; label: string; emoji: string }[] = [
  { key: "study", label: "Study", emoji: "📖" },
  { key: "quiz", label: "Quiz", emoji: "🧠" },
  { key: "practice", label: "Practice", emoji: "🎸" },
  { key: "perform", label: "Perform", emoji: "🎮" },
];

export default function LessonSuiteNav({
  stage,
  completedStages,
  onStageChange,
}: LessonSuiteNavProps) {
  return (
    <div
      className="flex items-center justify-center gap-2 flex-wrap mb-6"
      role="tablist"
      aria-label="Lesson stages"
    >
      {STAGES.map((s, idx) => {
        const isActive = stage === s.key;
        const isDone = completedStages.has(s.key);

        let borderColor = "rgba(255,255,255,0.1)";
        let bg = "rgba(255,255,255,0.04)";
        let textColor = "rgba(255,255,255,0.5)";
        let boxShadow = "none";

        if (isActive) {
          borderColor = "rgba(124,58,237,0.7)";
          bg = "rgba(124,58,237,0.15)";
          textColor = "#c4b5fd";
          boxShadow = "0 0 12px rgba(124,58,237,0.4)";
        } else if (isDone) {
          borderColor = "rgba(34,197,94,0.5)";
          bg = "rgba(34,197,94,0.08)";
          textColor = "#86efac";
        }

        return (
          <React.Fragment key={s.key}>
            {idx > 0 && (
              <span
                className="text-xs hidden sm:block"
                style={{ color: "rgba(255,255,255,0.2)" }}
                aria-hidden="true"
              >
                →
              </span>
            )}
            <button
              role="tab"
              aria-selected={isActive}
              onClick={() => onStageChange(s.key)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200"
              style={{
                border: `1px solid ${borderColor}`,
                background: bg,
                color: textColor,
                boxShadow,
                cursor: "pointer",
              }}
            >
              <span>{s.emoji}</span>
              <span>{s.label}</span>
              {isDone && !isActive && (
                <span style={{ color: "#86efac", marginLeft: "2px" }}>✓</span>
              )}
              {isActive && (
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: "#c4b5fd", marginLeft: "2px" }}
                  aria-hidden="true"
                />
              )}
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
}
