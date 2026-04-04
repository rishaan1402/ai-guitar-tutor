"use client";

import { useEffect, useState } from "react";

interface Props {
  onComplete: () => void;
}

const STAGES: (string | number)[] = [3, 2, 1, "GO!"];

export default function CountdownOverlay({ onComplete }: Props) {
  const [stageIdx, setStageIdx] = useState(0);

  useEffect(() => {
    if (stageIdx < STAGES.length) {
      const timer = setTimeout(() => {
        setStageIdx((prev) => prev + 1);
      }, 800);
      return () => clearTimeout(timer);
    } else {
      // All stages done.
      const timer = setTimeout(onComplete, 200);
      return () => clearTimeout(timer);
    }
  }, [stageIdx, onComplete]);

  if (stageIdx >= STAGES.length) return null;

  const current = STAGES[stageIdx];
  const isGo = current === "GO!";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 40,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
      }}
    >
      <span
        key={stageIdx}
        className={`font-black select-none ${isGo ? "text-green-400" : "text-white"}`}
        style={{
          fontSize: isGo ? "5rem" : "7rem",
          animation: "countdown-pulse 800ms ease-out forwards",
          textShadow: isGo
            ? "0 0 40px rgba(34,197,94,0.5)"
            : "0 0 40px rgba(139,92,246,0.4)",
        }}
      >
        {current}
      </span>
    </div>
  );
}
