"use client";

import React, { useEffect, useState } from "react";

const STEPS = [
  { label: "Analyzing song", icon: "🔍", delay: 0 },
  { label: "Consulting specialists", icon: "🤝", delay: 1500 },
  { label: "Chairman synthesizing", icon: "⚡", delay: 5000 },
];

interface CouncilProgressProps {
  active: boolean;
}

export default function CouncilProgress({ active }: CouncilProgressProps) {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (!active) {
      setCurrentStep(0);
      return;
    }
    const timers = STEPS.slice(1).map((step, i) =>
      setTimeout(() => setCurrentStep(i + 1), step.delay)
    );
    return () => timers.forEach(clearTimeout);
  }, [active]);

  if (!active) return null;

  return (
    <div className="w-full max-w-2xl mx-auto mt-10 fade-in-up">
      <div className="glass-card p-8 text-center">
        {/* spinning ring */}
        <div className="flex justify-center mb-6">
          <div
            className="w-16 h-16 rounded-full"
            style={{
              background: "conic-gradient(from 0deg, #7c3aed, #2563eb, #0891b2, transparent)",
              animation: "spin 1.2s linear infinite",
            }}
          />
        </div>

        <p className="gradient-text text-lg font-semibold mb-8">
          Building your personalised lesson...
        </p>

        <div className="flex items-center justify-center gap-4">
          {STEPS.map((step, i) => {
            const done = i < currentStep;
            const active_ = i === currentStep;
            return (
              <React.Fragment key={i}>
                <div className="flex flex-col items-center gap-2">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-lg transition-all duration-500"
                    style={{
                      background: done
                        ? "rgba(34,197,94,0.25)"
                        : active_
                        ? "rgba(124,58,237,0.3)"
                        : "rgba(255,255,255,0.05)",
                      border: done
                        ? "1px solid rgba(34,197,94,0.5)"
                        : active_
                        ? "1px solid rgba(124,58,237,0.6)"
                        : "1px solid rgba(255,255,255,0.1)",
                      boxShadow: active_ ? "0 0 16px rgba(124,58,237,0.4)" : "none",
                      animation: active_ ? "step-pulse 2s ease-in-out infinite" : "none",
                    }}
                  >
                    {done ? "✓" : step.icon}
                  </div>
                  <span
                    className="text-xs text-center max-w-20"
                    style={{
                      color: done ? "#22c55e" : active_ ? "#a78bfa" : "rgba(255,255,255,0.35)",
                    }}
                  >
                    {step.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className="h-px w-8 transition-all duration-700"
                    style={{
                      background: done
                        ? "rgba(34,197,94,0.5)"
                        : "rgba(255,255,255,0.1)",
                    }}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>

        <p className="mt-6 text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
          This usually takes 6–10 seconds
        </p>
      </div>

      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
