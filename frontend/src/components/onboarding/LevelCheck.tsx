"use client";

import { useEffect, useRef, useState } from "react";
import { frameStats, toDbfs, dbfsToLevel } from "@/lib/audioCapture";
import { LEVEL_PASS_DBFS, initialLevel, levelHintFor, pushLevel, type LevelState } from "@/lib/tuner";

interface Props {
  analyser: AnalyserNode;
  onPassed: (peakDbfs: number) => void;
}

const TIMEOUT_MS = 8000;

/** Step 2: "Strum any open strings" until the peak reaches the green band (−30 dBFS). */
export default function LevelCheck({ analyser, onPassed }: Props) {
  const [level, setLevel] = useState(0);
  const [state, setState] = useState<LevelState>(initialLevel);
  const [timedOut, setTimedOut] = useState(false);
  const stRef = useRef<LevelState>(initialLevel());
  const doneRef = useRef(false);
  const onPassedRef = useRef(onPassed);
  onPassedRef.current = onPassed;

  useEffect(() => {
    const buf = new Float32Array(analyser.fftSize);
    let raf = 0;
    let lastUi = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      analyser.getFloatTimeDomainData(buf);
      const { rms, peak } = frameStats(buf);
      stRef.current = pushLevel(stRef.current, toDbfs(rms), toDbfs(peak), now - t0);
      if (now - lastUi > 66) {
        lastUi = now;
        setLevel(dbfsToLevel(toDbfs(peak)));
        setState(stRef.current);
      }
      if (stRef.current.passed && !doneRef.current) {
        doneRef.current = true;
        setState(stRef.current);
        const peakDb = stRef.current.peakDbfs;
        setTimeout(() => onPassedRef.current(peakDb), 600);
      }
      if (!doneRef.current && now - t0 > TIMEOUT_MS) setTimedOut(true);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [analyser]);

  const hint = levelHintFor(state);
  const goodAt = dbfsToLevel(LEVEL_PASS_DBFS);
  const pct = Math.round(level * 100);

  return (
    <div className="flex flex-col items-center text-center gap-5" data-testid="step-level">
      <p className="text-body text-gray-300">Strum any open strings.</p>
      <div className="w-full max-w-sm">
        <div
          className="relative h-4 rounded-full bg-white/5 overflow-hidden"
          role="meter"
          aria-label="Input level"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          aria-valuetext={state.passed ? "Good level" : `${pct} percent`}
        >
          <div className="absolute inset-y-0 bg-emerald-300/15" style={{ left: `${goodAt * 100}%`, right: 0 }} />
          <div
            className={`absolute inset-y-0 left-0 rounded-full ${state.passed ? "bg-emerald-300" : "bg-cream/60"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-gray-500">Aim for the green band.</p>
      </div>
      <p className="min-h-[1.5rem] text-sm" role="status">
        {state.passed ? (
          <span className="text-emerald-200">Sounds good — I can hear you.</span>
        ) : hint === "clipping" ? (
          <span className="text-[#de7a5c]">That&apos;s distorting — move back a little.</span>
        ) : hint === "noisy" ? (
          <span className="text-amber-200">It&apos;s noisy here — move closer to the guitar.</span>
        ) : timedOut ? (
          <span className="text-amber-200">Not much yet — strum a bit harder, or move the mic closer to the soundhole.</span>
        ) : null}
      </p>
      {timedOut && !state.passed && (
        <button
          type="button"
          onClick={() => onPassedRef.current(state.peakDbfs)}
          className="text-sm text-gray-300 underline underline-offset-4 decoration-white/20"
        >
          Continue anyway
        </button>
      )}
    </div>
  );
}
