"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/lib/motion";
import {
  IN_TUNE_CENTS,
  OPEN_STRINGS,
  centsText,
  initialTuner,
  pushReading,
  rmsDbfs,
  selectString,
  type TunerState,
} from "@/lib/tuner";

interface Props {
  analyser: AnalyserNode;
  sampleRate: number;
  onDone: () => void;
}

const WINDOW = 4096;
const INTERVAL_MS = 50; // 20 Hz, not every frame

/**
 * Step 3: six string chips and a ±50 c needle. Time-domain MPM (pitchy,
 * loaded only here) over 4096-sample windows at 20 Hz.
 */
export default function Tuner({ analyser, sampleRate, onDone }: Props) {
  const reduceMotion = useReducedMotion();
  const [st, setSt] = useState<TunerState>(() => initialTuner(0));
  const stRef = useRef(st);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    (async () => {
      try {
        const { PitchDetector } = await import("pitchy");
        if (cancelled) return;
        const detector = PitchDetector.forFloat32Array(WINDOW);
        const buf = new Float32Array(WINDOW);
        setReady(true);
        timer = setInterval(() => {
          if (analyser.fftSize >= WINDOW) analyser.getFloatTimeDomainData(buf);
          else return;
          const [hz, clarity] = detector.findPitch(buf, sampleRate);
          const r = pushReading(stRef.current, { hz, clarity, rmsDbfs: rmsDbfs(buf), t: performance.now() });
          if (r.state !== stRef.current) {
            stRef.current = r.state;
            setSt(r.state);
          }
        }, INTERVAL_MS);
      } catch {
        if (!cancelled) setLoadError(true);
      }
    })();
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [analyser, sampleRate]);

  const pick = (i: number) => {
    stRef.current = selectString(stRef.current, i);
    setSt(stRef.current);
  };

  const all = st.tuned.length === OPEN_STRINGS.length;
  const cents = st.cents;
  const clamped = cents === null ? 0 : Math.max(-50, Math.min(50, cents));
  const angle = (clamped / 50) * 60; // ±60° arc
  const inTune = cents !== null && Math.abs(cents) <= IN_TUNE_CENTS;
  const current = st.index !== null ? OPEN_STRINGS[st.index] : null;

  useEffect(() => {
    if (all) {
      const t = setTimeout(onDone, 700);
      return () => clearTimeout(t);
    }
  }, [all, onDone]);

  return (
    <div className="flex flex-col items-center text-center gap-5" data-testid="step-tune">
      <p className="text-body text-gray-300">
        {current ? (
          <>
            Pluck the <span className="font-semibold text-cream">{current.name}</span> string (string {current.string}) and let it ring.
          </>
        ) : (
          "Pluck any open string."
        )}
      </p>

      <div className="flex gap-2" role="group" aria-label="Strings">
        {OPEN_STRINGS.map((s, i) => {
          const done = st.tuned.includes(i);
          const sel = st.target === i;
          return (
            <button
              key={s.string}
              type="button"
              onClick={() => pick(i)}
              aria-pressed={sel}
              aria-label={`String ${s.string}, ${s.name}${done ? ", in tune" : ""}`}
              className={`w-11 h-11 rounded-full border text-sm font-semibold ${
                reduceMotion ? "" : "transition-colors duration-fast"
              } ${
                done
                  ? "border-emerald-300/60 bg-emerald-300/15 text-emerald-100"
                  : sel
                  ? "border-amber-300/70 bg-amber-300/10 text-amber-100"
                  : "border-white/15 text-gray-300 hover:border-white/30"
              }`}
              data-tuned={done || undefined}
            >
              {done ? "✓" : s.name}
            </button>
          );
        })}
      </div>

      <div
        className="relative w-[260px] max-w-full"
        role="meter"
        aria-label={current ? `Tuning string ${current.string}` : "Tuning"}
        aria-valuemin={-50}
        aria-valuemax={50}
        aria-valuenow={cents === null ? 0 : Math.round(clamped)}
        aria-valuetext={cents === null ? "listening" : centsText(cents)}
        data-testid="tuner-needle"
      >
        <svg viewBox="-130 -120 260 130" className="w-full" aria-hidden>
          <path d={arc(-50, 50)} fill="none" stroke="rgba(243,234,216,0.12)" strokeWidth={10} strokeLinecap="round" />
          {/* sage ±5 c zone */}
          <path d={arc(-6, 6)} fill="none" stroke="rgba(163,198,171,0.55)" strokeWidth={10} />
          {[-50, -25, 0, 25, 50].map((c) => {
            const a = ((c / 50) * 60 * Math.PI) / 180;
            return <line key={c} x1={Math.sin(a) * 108} y1={-Math.cos(a) * 108} x2={Math.sin(a) * 96} y2={-Math.cos(a) * 96} stroke="rgba(243,234,216,0.3)" strokeWidth={1.5} />;
          })}
          <g
            style={{
              transform: `rotate(${angle}deg)`,
              transformOrigin: "0px 0px",
              transition: reduceMotion ? "none" : "transform var(--dur-fast) var(--ease-out-expo)",
            }}
          >
            <line x1={0} y1={0} x2={0} y2={-112} stroke={inTune ? "#a3c6ab" : "#efc27a"} strokeWidth={3} strokeLinecap="round" />
          </g>
          <circle r={6} fill={inTune ? "#a3c6ab" : "#efc27a"} />
        </svg>
        <p className="mt-1 font-display text-h3 text-cream tabular-nums min-h-[1.75rem]">
          {!ready ? (loadError ? "Tuner unavailable" : "…") : cents === null ? "Listening…" : `${cents > 0 ? "+" : ""}${Math.round(cents)} c`}
        </p>
        <p className="text-xs text-gray-500 min-h-[1rem]">
          {cents === null ? "" : inTune ? "Hold it…" : cents > 0 ? "Sharp — loosen the peg a little" : "Flat — tighten the peg a little"}
        </p>
      </div>

      <div className="flex items-center gap-4 text-sm">
        {st.tuned.length >= 3 && !all && (
          <button type="button" onClick={onDone} className="rounded-xl bg-amber-400 text-[#1c1206] px-4 py-2 font-semibold hover:bg-amber-300">
            Good enough →
          </button>
        )}
        <button type="button" onClick={onDone} className="text-gray-400 hover:text-gray-200 underline underline-offset-4 decoration-white/20">
          Skip tuning
        </button>
      </div>
    </div>
  );
}

/** SVG arc on the r=120 dial between two cent values. */
function arc(c0: number, c1: number): string {
  const p = (c: number) => {
    const a = ((c / 50) * 60 * Math.PI) / 180;
    return `${(Math.sin(a) * 102).toFixed(2)} ${(-Math.cos(a) * 102).toFixed(2)}`;
  };
  return `M ${p(c0)} A 102 102 0 0 1 ${p(c1)}`;
}
