"use client";

import { useEffect, useState } from "react";
import { strumOpen } from "@/lib/sound";

const SEEN_KEY = "open-strings-intro";
const NAMES = ["E", "A", "D", "G", "B", "e"];

/**
 * Opening curtain: six strings across a dark stage under the wordmark. They're
 * strummed, then part left and right to reveal the room. Plays once per
 * session, can be skipped, and never runs under prefers-reduced-motion.
 */
export default function Intro() {
  const [phase, setPhase] = useState<"hidden" | "show" | "strum" | "open" | "gone">("hidden");

  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem(SEEN_KEY) === "1";
    } catch {
      /* storage blocked: just show it */
    }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (seen || reduced) {
      setPhase("gone");
      return;
    }
    setPhase("show");
    const t1 = window.setTimeout(() => setPhase("strum"), 650);
    const t2 = window.setTimeout(() => setPhase("open"), 1700);
    const t3 = window.setTimeout(() => finish(), 2500);
    return () => [t1, t2, t3].forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finish = () => {
    setPhase("gone");
    try {
      sessionStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  const enter = () => {
    strumOpen();
    setPhase("open");
    window.setTimeout(finish, 700);
  };

  if (phase === "gone" || phase === "hidden") return null;
  const open = phase === "open";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden"
      role="dialog"
      aria-label="Open Strings"
      onClick={enter}
    >
      {/* two halves of the curtain */}
      <div className={`absolute inset-y-0 left-0 w-1/2 bg-ink-950 transition-transform duration-story ease-out-expo ${open ? "-translate-x-full" : ""}`} />
      <div className={`absolute inset-y-0 right-0 w-1/2 bg-ink-950 transition-transform duration-story ease-out-expo ${open ? "translate-x-full" : ""}`} />

      {/* strings */}
      <div className={`absolute inset-x-0 top-1/2 -translate-y-1/2 transition-opacity duration-slow ${open ? "opacity-0" : "opacity-100"}`}>
        {NAMES.map((n, i) => (
          <div key={n + i} className="relative flex h-[clamp(28px,6vh,56px)] items-center">
            <span className="label-mono absolute left-4 text-cream/40 sm:left-8">{n}</span>
            <div
              className={`mx-12 h-px w-full origin-center sm:mx-16 ${phase === "strum" ? "os-intro-strum" : ""}`}
              style={{
                background: i === 3 ? "linear-gradient(90deg, transparent, #e8a54b 15%, #ffcf8a 50%, #e8a54b 85%, transparent)" : "linear-gradient(90deg, transparent, rgba(243,234,216,0.55) 15%, rgba(243,234,216,0.8) 50%, rgba(243,234,216,0.55) 85%, transparent)",
                height: `${2.4 - i * 0.3}px`,
                animationDelay: `${i * 45}ms`,
                transform: phase === "show" ? "scaleX(0.08)" : "scaleX(1)",
                transition: "transform 900ms cubic-bezier(0.16, 1, 0.3, 1)",
                transitionDelay: `${i * 50}ms`,
              }}
            />
          </div>
        ))}
      </div>

      {/* wordmark */}
      <h1
        className={`pointer-events-none relative font-display text-[clamp(3rem,13vw,11rem)] uppercase leading-[0.85] tracking-tight text-cream mix-blend-difference transition-all duration-slow ease-out-expo ${
          open ? "scale-110 opacity-0" : phase === "show" ? "opacity-0 translate-y-4" : "opacity-100"
        }`}
      >
        Open
        <br />
        Strings
      </h1>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          finish();
        }}
        className="label-mono absolute bottom-6 right-6 text-cream/60 hover:text-cream"
      >
        Skip ✕
      </button>
      <p className="label-mono absolute bottom-6 left-1/2 -translate-x-1/2 text-cream/40">Tap to strum</p>
    </div>
  );
}
