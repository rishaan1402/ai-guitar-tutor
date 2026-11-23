"use client";

/**
 * "Play it for me": hold the new chord and strum; passes after two clean strums.
 * The chord is compared with look-alikes (chords sharing notes), so a wrong
 * shape doesn't pass.
 */
import { useEffect, useRef, useState } from "react";
import { openMic, micErrorMessage } from "@/lib/mic";
import { ChordTracker, matchesExpected } from "@/lib/groove/detect";
import { chordNotes } from "@/lib/groove/theory";
import { prettySymbol } from "@/lib/chordShape";

const POOL = ["Em", "Am", "E", "A", "D", "G", "C", "Dm", "A7", "E7", "D7", "G7", "B7", "F", "Bm"];
const FFT = 4096;
const NEEDED = 2;

/** The target plus the three chords it's most easily confused with. */
export function lookAlikes(target: string): string[] {
  const t = new Set(chordNotes(target)?.pcs ?? []);
  const others = POOL.filter((c) => c !== target)
    .map((c) => ({ c, shared: (chordNotes(c)?.pcs ?? []).filter((p) => t.has(p)).length }))
    .sort((a, b) => b.shared - a.shared)
    .slice(0, 3)
    .map((x) => x.c);
  return [target, ...others];
}

export default function ChordCheck({ chord, onPass }: { chord: string; onPass: () => void }) {
  const [state, setState] = useState<"idle" | "listening" | "passed">("idle");
  const [heard, setHeard] = useState<string | null>(null);
  const [hits, setHits] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const stop = useRef<() => void>(() => {});

  useEffect(() => () => stop.current(), []);

  async function listen() {
    setError(null);
    try {
      const stream = await openMic();
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AC();
      const an = ctx.createAnalyser();
      an.fftSize = FFT;
      an.smoothingTimeConstant = 0;
      ctx.createMediaStreamSource(stream).connect(an);
      const tracker = new ChordTracker(lookAlikes(chord));
      const buf = new Float32Array(an.frequencyBinCount);
      let count = 0;
      const timer = setInterval(() => {
        an.getFloatFrequencyData(buf);
        const h = tracker.feed(buf, ctx.sampleRate, FFT, ctx.currentTime, chord);
        if (!h) return;
        setHeard(h.symbol);
        if (matchesExpected(h.symbol, chord)) {
          count += 1;
          setHits(count);
          tracker.reset(); // the next strum must be heard on its own
          if (count >= NEEDED) {
            stop.current();
            setState("passed");
            import("@capacitor/haptics").then(({ Haptics, NotificationType }) => Haptics.notification({ type: NotificationType.Success })).catch(() => {});
          }
        }
      }, 30);
      stop.current = () => {
        clearInterval(timer);
        stream.getTracks().forEach((t) => t.stop());
        void ctx.close();
      };
      setState("listening");
    } catch (e) {
      setError(micErrorMessage(e));
    }
  }

  return (
    <div className="rounded-[22px] border border-cream/10 p-4 text-center">
      <p className="label-mono text-amber-400">Play it for me</p>
      <p className="mt-1 text-cream/75">Hold {prettySymbol(chord)} and strum, let it ring. Twice clean and you&apos;re through.</p>
      <div className="mt-4 flex items-center justify-center gap-3" aria-live="polite">
        {Array.from({ length: NEEDED }, (_, i) => (
          <span key={i} className={`flex h-10 w-10 items-center justify-center rounded-full border text-lg ${i < hits ? "border-sage-300 bg-sage-300/20 text-sage-200" : "border-cream/15 text-cream/60"}`}>
            {i < hits ? "✓" : i + 1}
          </span>
        ))}
      </div>
      {state === "listening" && (
        <p className="mt-3 text-sm text-cream/60">
          Heard: <span className="font-semibold text-cream">{heard ? prettySymbol(heard) : "…"}</span>
          {heard && !matchesExpected(heard, chord) && <span className="text-amber-300"> (not quite: check the diagram)</span>}
        </p>
      )}
      {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
      <div className="mt-4">
        {state === "idle" && <button onClick={listen} className="h-12 rounded-full bg-amber-400 px-6 font-semibold text-ink-950">Start listening</button>}
        {state === "passed" && <button onClick={onPass} className="h-12 rounded-full bg-amber-400 px-6 font-semibold text-ink-950">Nice, continue →</button>}
      </div>
    </div>
  );
}
