"use client";

import React from "react";

export type Stage = "study" | "chart" | "quiz" | "practice" | "perform";

interface LessonSuiteNavProps {
  stage: Stage;
  completedStages: Set<Stage>;
  onStageChange: (s: Stage) => void;
}

const STAGES: { key: Stage; label: string }[] = [
  { key: "study", label: "Study" },
  { key: "chart", label: "Chart" },
  { key: "quiz", label: "Quiz" },
  { key: "practice", label: "Practice" },
  { key: "perform", label: "Perform" },
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

        let borderColor = "rgba(var(--cream-rgb),0.1)";
        let bg = "rgba(var(--cream-rgb),0.04)";
        let textColor = "rgba(var(--cream-rgb),0.5)";
        let boxShadow = "none";

        if (isActive) {
          borderColor = "rgba(var(--accent-rgb),0.7)";
          bg = "rgba(var(--accent-rgb),0.15)";
          textColor = "rgb(var(--acc-200))";
          boxShadow = "0 0 12px rgba(var(--accent-rgb),0.4)";
        } else if (isDone) {
          borderColor = "rgba(var(--sage-rgb),0.5)";
          bg = "rgba(var(--sage-rgb),0.08)";
          textColor = "rgb(var(--ok-300))";
        }

        return (
          <React.Fragment key={s.key}>
            {idx > 0 && (
              <span
                className="text-xs hidden sm:block"
                style={{ color: "rgba(var(--cream-rgb),0.2)" }}
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
              <span>{s.label}</span>
              {isDone && !isActive && (
                <span style={{ color: "rgb(var(--ok-300))", marginLeft: "2px" }}>✓</span>
              )}
              {isActive && (
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: "rgb(var(--acc-200))", marginLeft: "2px" }}
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
