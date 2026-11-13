"use client";

import { useSyncExternalStore } from "react";
import { isSoundOn, setSoundOn, subscribeSound } from "@/lib/sound";

/** Speaker button for the room's interface sounds (off by default). */
export default function SoundToggle({ className = "" }: { className?: string }) {
  const on = useSyncExternalStore(subscribeSound, isSoundOn, () => false);
  return (
    <button
      type="button"
      onClick={() => setSoundOn(!on)}
      aria-pressed={on}
      aria-label={on ? "Turn room sounds off" : "Turn room sounds on"}
      title={on ? "Room sounds on" : "Room sounds off"}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-full border border-cream/15 text-cream/80 transition-colors duration-fast hover:border-amber-400/60 hover:text-amber-300 ${className}`}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" fillOpacity="0.15" />
        {on ? (
          <>
            <path d="M16.5 8.5a5 5 0 0 1 0 7" />
            <path d="M19 6a8.5 8.5 0 0 1 0 12" />
          </>
        ) : (
          <path d="M17 9l5 6M22 9l-5 6" />
        )}
      </svg>
    </button>
  );
}
