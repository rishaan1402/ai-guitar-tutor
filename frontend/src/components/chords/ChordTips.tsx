"use client";

/** Coaching tips for a chord shape: written by the AI coach (checked against the shape) or from the shape itself. */
import { useEffect, useState } from "react";
import { getChordTips, type ChordFingering } from "@/lib/api";

export default function ChordTips({ symbol, fingering }: { symbol: string; fingering: ChordFingering }) {
  const [tips, setTips] = useState<string[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    setTips(null);
    setFailed(false);
    getChordTips(symbol, fingering)
      .then((r) => live && setTips(r.tips))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [symbol, fingering]);
  if (failed) return null;
  return (
    <section aria-labelledby="tips-h" className="rounded-[22px] border border-cream/10 p-4">
      <p id="tips-h" className="label-mono text-amber-400">Coach&apos;s tips</p>
      {tips ? (
        <ul className="mt-2 space-y-1.5 text-[15px] text-cream/85">
          {tips.map((t) => (
            <li key={t} className="flex gap-2">
              <span className="text-amber-400" aria-hidden="true">•</span>
              <span>{t}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-cream/50">Writing tips for this shape…</p>
      )}
    </section>
  );
}
