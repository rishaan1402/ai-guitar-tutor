"use client";

/**
 * The finish moment: stars pop in one by one with sparks, the XP floats up,
 * the open strings ring (if room sounds are on) and the phone buzzes.
 * Three stars also gets confetti.
 */
import { useEffect, useMemo } from "react";
import Confetti from "@/components/Confetti";
import { strumOpen } from "@/lib/sound";

const SPARK_COLOURS = ["rgb(var(--acc-300))", "rgb(var(--vio-300))", "rgb(var(--ok-300))"];

export default function Celebrate({ stars, xp, size = "lg" }: { stars: number; xp?: number; size?: "lg" | "md" }) {
  useEffect(() => {
    if (stars <= 0) return;
    const t = setTimeout(() => {
      strumOpen();
      import("@capacitor/haptics")
        .then(({ Haptics, NotificationType }) => Haptics.notification({ type: stars >= 3 ? NotificationType.Success : NotificationType.Warning }))
        .catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [stars]);

  const sparks = useMemo(
    () =>
      Array.from({ length: 10 }, (_, k) => {
        const a = (k / 10) * Math.PI * 2;
        const r = 34 + (k % 3) * 10;
        return { dx: `${Math.cos(a) * r}px`, dy: `${Math.sin(a) * r}px`, c: SPARK_COLOURS[k % 3] };
      }),
    [],
  );
  const px = size === "lg" ? "text-6xl short:text-5xl" : "text-4xl";

  return (
    <div className="relative flex flex-col items-center">
      <Confetti active={stars >= 3} />
      <div className={`flex items-center gap-2 ${px}`} aria-label={`${stars} of 3 stars`}>
        {[0, 1, 2].map((k) => {
          const on = k < stars;
          return (
            <span key={k} className="relative inline-block">
              <span
                className={`inline-block ${on ? "os-pop" : ""}`}
                style={{
                  animationDelay: `${150 + k * 260}ms`,
                  color: on ? "transparent" : "rgb(var(--text) / 0.15)",
                  background: on ? "linear-gradient(160deg, rgb(var(--acc-200)), rgb(var(--acc-400)) 45%, rgb(var(--vio-400)))" : undefined,
                  WebkitBackgroundClip: on ? "text" : undefined,
                  backgroundClip: on ? "text" : undefined,
                  filter: on ? "drop-shadow(0 0 10px rgba(var(--accent-rgb), 0.6))" : undefined,
                }}
              >
                ★
              </span>
              {on &&
                sparks.map((s, i) => (
                  <i
                    key={i}
                    className="os-spark left-1/2 top-1/2"
                    style={{ ["--dx" as string]: s.dx, ["--dy" as string]: s.dy, background: s.c, animationDelay: `${300 + k * 260}ms` }}
                  />
                ))}
            </span>
          );
        })}
      </div>
      {xp ? (
        <span className="os-float-up pointer-events-none absolute -top-2 right-0 font-display text-lg text-sage-300" style={{ animationDelay: "900ms" }}>
          +{xp} XP
        </span>
      ) : null}
    </div>
  );
}
