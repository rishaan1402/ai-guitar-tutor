"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/lib/motion";
import {
  IN_TUNE_CENTS,
  OPEN_STRINGS,
  TUNINGS,
  centsText,
  initialTuner,
  noteOf,
  pushReading,
  rmsDbfs,
  selectString,
  setTuning,
  type TunerState,
} from "@/lib/tuner";
import { playNotes } from "@/lib/path/synth";

interface Props {
  analyser: AnalyserNode;
  sampleRate: number;
  onDone: () => void;
  /**
   * Free mode (the Tuner page): listens for whichever string you play and never
   * stops; tuned strings keep their tick until they drift; tap a string to lock
   * onto it, Auto to go back. Without it, a guided pass through the six strings.
   */
  free?: boolean;
}

const TUNING_KEY = "os:tuning";
const savedTuning = () => {
  try {
    return TUNINGS.find((t) => t.id === localStorage.getItem(TUNING_KEY)) ?? TUNINGS[0];
  } catch {
    return TUNINGS[0];
  }
};

const WINDOW = 4096;
const INTERVAL_MS = 50; // 20 Hz, not every frame

/**
 * Step 3: six string chips and a ±50 c needle. Time-domain MPM (pitchy,
 * loaded only here) over 4096-sample windows at 20 Hz.
 */
export default function Tuner({ analyser, sampleRate, onDone, free = false }: Props) {
  const reduceMotion = useReducedMotion();
  const [tuningId, setTuningId] = useState(() => (free ? savedTuning().id : "standard"));
  const tuning = TUNINGS.find((t) => t.id === tuningId) ?? TUNINGS[0];
  const [st, setSt] = useState<TunerState>(() => (free ? initialTuner(null, savedTuning().strings, false) : initialTuner(0)));
  const [heardHz, setHeardHz] = useState<number | null>(null);
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
          const level = rmsDbfs(buf);
          const r = pushReading(stRef.current, { hz, clarity, rmsDbfs: level, t: performance.now() });
          if (clarity >= 0.9 && level > -50) setHeardHz(hz);
          if (r.justTuned !== null) {
            import("@capacitor/haptics").then(({ Haptics, ImpactStyle }) => Haptics.impact({ style: ImpactStyle.Medium })).catch(() => {});
          }
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
    // -1: back to Auto (listen for any string)
    stRef.current = selectString(stRef.current, i < 0 ? null : i);
    setSt(stRef.current);
  };

  const strings = st.strings;
  const all = st.tuned.length === strings.length;
  const cents = st.cents;
  const clamped = cents === null ? 0 : Math.max(-50, Math.min(50, cents));
  const angle = (clamped / 50) * 60; // ±60° arc
  const inTune = cents !== null && Math.abs(cents) <= IN_TUNE_CENTS;
  const current = st.index !== null ? strings[st.index] : null;

  const dial = (
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
          <path d={arc(-50, 50)} fill="none" stroke="rgba(var(--cream-rgb),0.12)" strokeWidth={10} strokeLinecap="round" />
          {/* sage ±5 c zone */}
          <path d={arc(-6, 6)} fill="none" stroke="rgba(var(--sage-soft-rgb),0.55)" strokeWidth={10} />
          {[-50, -25, 0, 25, 50].map((c) => {
            const a = ((c / 50) * 60 * Math.PI) / 180;
            return <line key={c} x1={Math.sin(a) * 108} y1={-Math.cos(a) * 108} x2={Math.sin(a) * 96} y2={-Math.cos(a) * 96} stroke="rgba(var(--cream-rgb),0.3)" strokeWidth={1.5} />;
          })}
          <g
            style={{
              transform: `rotate(${angle}deg)`,
              transformOrigin: "0px 0px",
              transition: reduceMotion ? "none" : "transform var(--dur-fast) var(--ease-out-expo)",
            }}
          >
            <line x1={0} y1={0} x2={0} y2={-112} stroke={inTune ? "rgb(var(--ok-300))" : "rgb(var(--acc-300))"} strokeWidth={3} strokeLinecap="round" />
          </g>
          <circle r={6} fill={inTune ? "rgb(var(--ok-300))" : "rgb(var(--acc-300))"} />
        </svg>
        <p className="mt-1 font-display text-h3 text-cream tabular-nums min-h-[1.75rem]">
          {!ready ? (loadError ? "Tuner unavailable" : "…") : cents === null ? "Listening…" : `${cents > 0 ? "+" : ""}${Math.round(cents)} c`}
        </p>
        <p className="text-xs text-gray-500 min-h-[1rem]">
          {cents === null ? "" : inTune ? (st.index !== null && st.tuned.includes(st.index) ? "In tune ✓" : "Hold it…") : cents > 0 ? "Sharp — loosen the peg a little" : "Flat — tighten the peg a little"}
        </p>
      </div>
  );

  const chooseTuning = (id: string) => {
    const t = TUNINGS.find((x) => x.id === id) ?? TUNINGS[0];
    setTuningId(t.id);
    try {
      localStorage.setItem(TUNING_KEY, t.id);
    } catch {
      /* storage blocked */
    }
    stRef.current = setTuning(stRef.current, t.strings);
    setSt(stRef.current);
  };
  /** The reference note: the string's open note through the speaker. */
  const reference = (i: number) => playNotes([Math.round(69 + 12 * Math.log2(strings[i].hz / 440))], 0.4);

  useEffect(() => {
    if (free) return; // the free tuner never leaves on its own
    if (all) {
      const t = setTimeout(onDone, 700);
      return () => clearTimeout(t);
    }
  }, [all, onDone, free]);

  if (free) {
    return (
      <div className="flex flex-col items-center gap-4 text-center short:gap-2" data-testid="step-tune">
        <h1 className="sr-only">Tuner</h1>
        <div className="flex w-full flex-wrap items-center justify-center gap-2">
          <label htmlFor="tuning" className="label-mono text-cream/50">Tuning</label>
          <select
            id="tuning"
            value={tuning.id}
            onChange={(e) => chooseTuning(e.target.value)}
            className="h-9 rounded-full border border-cream/15 bg-transparent px-3 text-sm text-cream"
          >
            {TUNINGS.map((t) => (
              <option key={t.id} value={t.id} className="bg-ink-900">{t.label}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => pick(-1)}
            aria-pressed={st.target === null}
            className={`h-9 rounded-full border px-4 text-sm font-semibold ${st.target === null ? "border-amber-400 bg-amber-400/15 text-amber-100" : "border-cream/15 text-cream/70"}`}
          >
            Auto
          </button>
        </div>

        <div className="grid w-full items-center gap-4 landscape:grid-cols-[1fr_auto_1fr]">
          {/* the headstock: low strings left, high strings right, like looking at the guitar */}
          <StringColumn strings={strings} idx={[2, 1, 0]} st={st} onPick={pick} onHear={reference} />
          <div className="flex flex-col items-center">
            <p className="label-mono text-cream/50">
              {st.target === null ? "Auto: play any string" : `Locked on string ${strings[st.target].string}`}
            </p>
            <p className={`font-display text-7xl leading-none short:text-5xl ${inTune ? "text-sage-300" : "text-cream"}`} aria-live="polite">
              {current ? current.name : "–"}
            </p>
            <p className="label-mono text-[11px] text-cream/60">{heardHz ? `${noteOf(heardHz)} · ${heardHz.toFixed(1)} Hz` : "\u00a0"}</p>
            <div className="w-[240px] max-w-full short:w-[180px]">{dial}</div>
          </div>
          <StringColumn strings={strings} idx={[3, 4, 5]} st={st} onPick={pick} onHear={reference} />
        </div>

        <p className="text-sm text-cream/60" aria-live="polite">
          {all ? "All six in tune. Keep playing: if a string drifts, it loses its tick and you can tune it again." : `${st.tuned.length} of 6 in tune · tap a string to lock onto it, the speaker to hear its note`}
        </p>
        <button type="button" onClick={onDone} className="h-11 rounded-full bg-amber-400 px-6 font-semibold text-ink-950">Done</button>
      </div>
    );
  }

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
        {strings.map((s, i) => {
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

      {dial}

      <div className="flex items-center gap-4 text-sm">
        {st.tuned.length >= 3 && !all && (
          <button type="button" onClick={onDone} className="rounded-xl bg-amber-400 text-[rgb(var(--ink-950))] px-4 py-2 font-semibold hover:bg-amber-300">
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

/** Three tuning pegs: tap the note to lock onto that string, the speaker to hear it. */
function StringColumn({ strings, idx, st, onPick, onHear }: { strings: TunerState["strings"]; idx: number[]; st: TunerState; onPick: (i: number) => void; onHear: (i: number) => void }) {
  return (
    <div className="flex justify-center gap-2 landscape:flex-col landscape:items-center" role="group" aria-label="Strings">
      {idx.map((i) => {
        const s = strings[i];
        const done = st.tuned.includes(i);
        const now = st.index === i;
        const locked = st.target === i;
        return (
          <div key={i} className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onPick(locked ? -1 : i)}
              aria-pressed={locked}
              aria-label={`String ${s.string}, ${s.name}${done ? ", in tune" : ""}${locked ? ", locked" : ""}`}
              className={`relative flex h-12 w-12 items-center justify-center rounded-full border-2 font-display text-lg transition-all ${
                done ? "border-sage-300 bg-sage-300/15 text-sage-100" : now ? "border-amber-400 bg-amber-400/15 text-amber-100 shadow-glow-sm" : "border-cream/15 text-cream/75"
              } ${locked ? "ring-2 ring-amber-300 ring-offset-2 ring-offset-ink-950" : ""}`}
            >
              {s.name}
              {done && <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-sage-300 text-[11px] text-ink-950">✓</span>}
            </button>
            <button type="button" onClick={() => onHear(i)} aria-label={`Hear the ${s.name} string`} className="flex h-8 w-8 items-center justify-center rounded-full text-cream/50 hover:text-amber-300">
              ♪
            </button>
          </div>
        );
      })}
    </div>
  );
}
