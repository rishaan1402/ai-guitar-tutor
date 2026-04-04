"use client";

import type { ReactNode } from "react";

interface Step {
  label: string;
  icon: ReactNode;
}

interface Props {
  steps: Step[];
  currentStep: number;
  completedSteps: Set<number>;
}

export default function StepIndicator({ steps, currentStep, completedSteps }: Props) {
  return (
    <div className="flex items-center justify-center gap-0 w-full px-2">
      {steps.map((step, i) => {
        const isCompleted = completedSteps.has(i);
        const isCurrent = i === currentStep;
        const isFuture = !isCompleted && !isCurrent;

        return (
          <div key={step.label} className="flex items-center">
            {/* Step circle + label */}
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`
                  w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold
                  transition-all duration-500
                  ${isCompleted
                    ? "bg-green-500/20 border-2 border-green-500 text-green-400"
                    : isCurrent
                      ? "bg-purple-500/20 border-2 border-purple-500 text-purple-300 animate-step-pulse"
                      : "bg-white/5 border border-white/10 text-gray-500"
                  }
                `}
              >
                {isCompleted ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <span>{step.icon}</span>
                )}
              </div>
              <span
                className={`text-xs font-medium hidden sm:block transition-colors duration-300 ${
                  isCompleted
                    ? "text-green-400"
                    : isCurrent
                      ? "text-purple-300"
                      : "text-gray-500"
                }`}
              >
                {step.label}
              </span>
            </div>

            {/* Connector line */}
            {i < steps.length - 1 && (
              <div
                className={`
                  w-8 sm:w-14 md:w-20 h-0.5 mx-1 sm:mx-2 transition-all duration-500
                  ${isCompleted
                    ? "bg-gradient-to-r from-green-500 to-green-500/50"
                    : isCurrent
                      ? "bg-gradient-to-r from-purple-500/50 to-white/10"
                      : "bg-white/10"
                  }
                `}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
