"use client";

import { useEffect, useState } from "react";

export const MASTERY_V2_KEY = "agt:mastery-v2-seen";

/** One-time note for existing learners: what "mastered" means now. */
export function MasteryBanner() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      setShow(window.localStorage.getItem(MASTERY_V2_KEY) !== "1");
    } catch {
      setShow(false);
    }
  }, []);
  if (!show) return null;
  const dismiss = () => {
    try {
      window.localStorage.setItem(MASTERY_V2_KEY, "1");
    } catch {
      // ignore
    }
    setShow(false);
  };
  return (
    <div
      className="rounded-2xl border border-amber-300/25 bg-amber-300/[0.05] px-4 py-3 flex flex-col sm:flex-row sm:items-start gap-3"
      role="note"
      data-testid="mastery-banner"
    >
      <p className="text-sm text-gray-200 leading-relaxed flex-1">
        Mastery now means a clean take on 3 different days, with quick re-checks later, so it sticks. Chords
        you&apos;d mastered before may show &lsquo;Clean day 1 of 3&rsquo;: one clean strum on another day brings
        them back.
      </p>
      <button
        type="button"
        onClick={dismiss}
        className="self-end sm:self-start text-xs font-semibold text-amber-200 border border-amber-300/30 rounded-lg px-3 py-1.5 hover:bg-amber-300/10"
      >
        Got it
      </button>
    </div>
  );
}
