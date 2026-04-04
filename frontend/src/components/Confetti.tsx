"use client";

import { useEffect, useMemo, useState } from "react";

const COLORS = ["#a78bfa", "#38bdf8", "#22d3ee", "#f59e0b", "#ef4444", "#22c55e", "#ec4899"];

interface Props {
  active: boolean;
  duration?: number;
}

interface Particle {
  id: number;
  x: number;
  color: string;
  size: number;
  delay: number;
  animDuration: number;
  isCircle: boolean;
}

export default function Confetti({ active, duration = 3000 }: Props) {
  const [visible, setVisible] = useState(false);

  const particles: Particle[] = useMemo(() => {
    if (!active) return [];
    const count = typeof window !== "undefined" && window.innerWidth < 640 ? 30 : 50;
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      size: 6 + Math.random() * 8,
      delay: Math.random() * 1000,
      animDuration: 2000 + Math.random() * 2000,
      isCircle: Math.random() > 0.5,
    }));
  }, [active]);

  useEffect(() => {
    if (active) {
      setVisible(true);
      const timer = setTimeout(() => setVisible(false), duration + 1500);
      return () => clearTimeout(timer);
    }
  }, [active, duration]);

  if (!visible || particles.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 50,
        overflow: "hidden",
      }}
    >
      {particles.map((p) => (
        <div
          key={p.id}
          style={{
            position: "absolute",
            left: `${p.x}%`,
            top: "-12px",
            width: p.size,
            height: p.isCircle ? p.size : p.size * 1.5,
            backgroundColor: p.color,
            borderRadius: p.isCircle ? "50%" : "2px",
            animation: `confetti-fall ${p.animDuration}ms ${p.delay}ms ease-in forwards`,
            opacity: 0,
            animationFillMode: "forwards",
          }}
        />
      ))}
    </div>
  );
}
