"use client";

/** Shown once when you reach a new level: the level, its title and what it unlocks. */
import { useEffect } from "react";
import Confetti from "@/components/Confetti";
import { strumOpen } from "@/lib/sound";

export default function LevelUp({ level, title, unlock, onClose }: { level: number; title: string; unlock?: string | null; onClose: () => void }) {
  useEffect(() => {
    strumOpen();
    import("@capacitor/haptics").then(({ Haptics, NotificationType }) => Haptics.notification({ type: NotificationType.Success })).catch(() => {});
  }, []);
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-ink-950/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={`Level ${level}`} onClick={onClose}>
      <Confetti active />
      <div className="os-pop relative w-full max-w-sm overflow-hidden rounded-[28px] border border-amber-400/40 bg-ink-900 p-6 text-center shadow-glow-md" onClick={(e) => e.stopPropagation()}>
        <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(80% 60% at 50% 0%, rgba(var(--accent-rgb), 0.28), transparent 70%), radial-gradient(60% 50% at 100% 100%, rgba(var(--violet-rgb), 0.25), transparent 70%)" }} />
        <p className="label-mono relative text-amber-300">Level up</p>
        <p className="relative mt-1 font-display text-7xl short:text-6xl" style={{ background: "linear-gradient(160deg, rgb(var(--acc-200)), rgb(var(--acc-400)) 45%, rgb(var(--vio-400)))", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
          {level}
        </p>
        <p className="relative font-display text-xl uppercase text-cream">{title}</p>
        {unlock && <p className="relative mt-3 text-sm text-cream/75">New in your room: <span className="font-semibold text-sage-300">{unlock}</span></p>}
        <button onClick={onClose} className="os-shine relative mt-5 h-12 w-full rounded-full bg-amber-400 font-semibold text-ink-950">Keep playing →</button>
      </div>
    </div>
  );
}
