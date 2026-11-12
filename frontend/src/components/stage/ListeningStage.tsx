"use client";

import { useEffect, useMemo, useRef } from "react";
import StringField, { type ListenState } from "./StringField";
import type { ChordFingering } from "@/lib/api";
import { createEnergyState, stringEnergies, stringTargets, type StringVerdict } from "@/lib/stringEnergy";
import { formatChord } from "@/lib/chordName";

interface Props {
  fingering: ChordFingering | null;
  /** The recorder's fftSize-8192 analyser while the mic is open, else null (static fingering view). */
  analyser?: AnalyserNode | null;
  state: ListenState;
  verdicts?: StringVerdict[] | null;
  className?: string;
}

interface StageProbe {
  energy: Float32Array;
  extra: Float32Array;
  log: { t: number; e: number[]; x: number[] }[];
}

/**
 * The live listening stage: reads the analyser at frame rate, turns it into
 * per-string energies (lib/stringEnergy) and hands them to the StringField
 * `listen` variant through refs. Coaching only — never used for grading.
 */
export default function ListeningStage({ fingering, analyser, state, verdicts, className }: Props) {
  const targets = useMemo(() => stringTargets(fingering), [fingering]);
  const energyRef = useRef(new Float32Array(6));
  const extraRef = useRef(new Float32Array(6));
  const listening = state === "armed" || state === "recording";

  useEffect(() => {
    energyRef.current.fill(0);
    extraRef.current.fill(0);
    if (!analyser || !listening) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const es = createEnergyState();
    const buf = new Float32Array(analyser.frequencyBinCount);
    const sr = analyser.context.sampleRate;
    let probe: StageProbe | null = null;
    if (/[?&]perf=1\b/.test(window.location.search)) {
      probe = { energy: energyRef.current, extra: extraRef.current, log: [] };
      (window as unknown as { __listenStage?: StageProbe }).__listenStage = probe;
    }
    let last = performance.now();
    let raf = 0;
    let interval: ReturnType<typeof setInterval> | null = null;

    const step = () => {
      const now = performance.now();
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      analyser.getFloatFrequencyData(buf);
      stringEnergies(buf, sr, analyser.fftSize, targets, es, dt);
      energyRef.current.set(es.energy);
      extraRef.current.set(es.extra);
      if (probe && probe.log.length < 2000) {
        probe.log.push({ t: now, e: Array.from(es.energy), x: Array.from(es.extra) });
      }
    };
    if (reduceMotion) {
      interval = setInterval(step, 100);
    } else {
      const loop = () => {
        step();
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }
    return () => {
      cancelAnimationFrame(raf);
      if (interval) clearInterval(interval);
      energyRef.current.fill(0);
      extraRef.current.fill(0);
    };
  }, [analyser, listening, targets]);

  const name = formatChord(fingering?.chord) || "this chord";
  const label =
    state === "done" && verdicts
      ? `Strings for ${name}: ` +
        targets
          .map((t, i) => `string ${t.string} ${verdicts[i] === "muted" ? "muted" : `${t.note ?? ""} ${verdicts[i]}`}`)
          .join(", ")
      : listening
      ? `Listening: each string of ${name} lights up when its note is heard`
      : `String view of ${name}`;

  return (
    <div className={`relative rounded-2xl glass overflow-hidden ${className ?? ""}`}>
      <StringField
        variant="listen"
        className="absolute inset-0 w-full h-full"
        targets={targets}
        energyRef={energyRef}
        extraRef={extraRef}
        state={state}
        verdicts={verdicts}
        label={label}
      />
    </div>
  );
}
