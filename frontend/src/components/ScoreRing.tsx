"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/lib/motion";

interface Props {
  score: number;
  size?: number;
  strokeWidth?: number;
  animate?: boolean;
  previousBest?: number | null;
}

function colorForScore(score: number): string {
  if (score >= 0.8) return "#86b092";
  if (score >= 0.5) return "#e8a54b";
  return "#e8604f";
}

export default function ScoreRing({
  score,
  size = 120,
  strokeWidth = 8,
  animate = true,
  previousBest,
}: Props) {
  const reduceMotion = useReducedMotion();
  const shouldAnimate = animate && !reduceMotion;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const [offset, setOffset] = useState(circumference);
  const [displayValue, setDisplayValue] = useState(0);
  const animRef = useRef(0);

  const isNewBest = previousBest != null && score > previousBest;
  const target = Math.round(score * 100);

  useEffect(() => {
    if (!shouldAnimate) {
      setOffset(circumference * (1 - score));
      setDisplayValue(target);
      return;
    }

    // Trigger ring animation after brief delay.
    const timer = setTimeout(() => {
      setOffset(circumference * (1 - score));
    }, 150);

    // Counter animation.
    let start: number | null = null;
    const duration = 1500;

    function animateCount(timestamp: number) {
      if (!start) start = timestamp;
      const progress = Math.min((timestamp - start) / duration, 1);
      // Expo ease-out
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setDisplayValue(Math.round(eased * target));
      if (progress < 1) {
        animRef.current = requestAnimationFrame(animateCount);
      }
    }

    animRef.current = requestAnimationFrame(animateCount);

    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(animRef.current);
    };
  }, [score, shouldAnimate, circumference, target]);

  const color = colorForScore(score);

  return (
    <div
      className="relative inline-flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Score ${target}%`}
    >
      <svg
        width={size}
        height={size}
        aria-hidden
        style={{ transform: "rotate(-90deg)" }}
      >
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={strokeWidth}
        />
        {/* Foreground arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{
            transition: shouldAnimate
              ? "stroke-dashoffset 1.5s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.5s ease"
              : "none",
          }}
        />
      </svg>

      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center" aria-hidden>
        {/* Font scales with the ring so "100%" always fits inside the track */}
        <span
          data-testid="score-ring-value"
          className="font-bold tabular-nums leading-none whitespace-nowrap"
          style={{ color, fontSize: Math.round(size * 0.25) }}
        >
          {displayValue}%
        </span>
      </div>

      {/* New Best badge */}
      {isNewBest && (
        <div className="absolute -top-2 -right-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse-glow">
          New Best!
        </div>
      )}
    </div>
  );
}
