"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import MicPermission from "./MicPermission";
import LevelCheck from "./LevelCheck";
import Tuner from "./Tuner";
import FirstChord from "./FirstChord";
import { markOnboarded } from "./onboardingStore";
import { getAccessToken } from "@/lib/auth";

export type OnboardingStep = "permission" | "level" | "tune" | "chord";

const STEPS: { key: OnboardingStep; label: string; title: string }[] = [
  { key: "permission", label: "Mic", title: "Let me hear your guitar" },
  { key: "level", label: "Level", title: "Check the level" },
  { key: "tune", label: "Tune", title: "Tune up" },
  { key: "chord", label: "First chord", title: "Your first chord" },
];

interface Props {
  /** ?step=tune: straight to the tuner (after the mic is allowed). */
  tuneOnly?: boolean;
}

/** 30-second setup: permission → level → tuner → Am. Skippable at every step. */
export default function OnboardingFlow({ tuneOnly = false }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<OnboardingStep>("permission");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [sampleRate, setSampleRate] = useState(48000);
  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const peakRef = useRef<number | undefined>(undefined);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  const closeGraph = useCallback(() => {
    const ctx = ctxRef.current;
    ctxRef.current = null;
    if (ctx && ctx.state !== "closed") ctx.close().catch(() => {});
    setAnalyser(null);
  }, []);

  // Release everything when leaving the page.
  useEffect(
    () => () => {
      closeGraph();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    },
    [closeGraph],
  );

  // Focus the step heading on each change (not on first paint).
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [step]);

  // The level check and tuner share one analyser; the first-chord recorder makes its own graph.
  useEffect(() => {
    if (step === "chord") closeGraph();
  }, [step, closeGraph]);

  function onGranted(s: MediaStream) {
    streamRef.current = s;
    setStream(s);
    try {
      const ctx = new AudioContext();
      ctx.resume?.().catch(() => {});
      const src = ctx.createMediaStreamSource(s);
      const an = ctx.createAnalyser();
      an.fftSize = 4096;
      an.smoothingTimeConstant = 0;
      src.connect(an);
      ctxRef.current = ctx;
      setSampleRate(ctx.sampleRate);
      setAnalyser(an);
    } catch {
      setAnalyser(null);
    }
    setStep(tuneOnly ? "tune" : "level");
  }

  function finishTo(href: string) {
    markOnboarded(peakRef.current);
    router.push(href);
  }

  const signedIn = typeof window !== "undefined" && !!getAccessToken();
  const practiceHref = "/practice?chord=A_minor";
  const shownSteps = tuneOnly ? STEPS.filter((s) => s.key === "permission" || s.key === "tune") : STEPS;
  const idx = shownSteps.findIndex((s) => s.key === step);
  const meta = shownSteps[Math.max(0, idx)];

  const afterTune = () => {
    if (tuneOnly) {
      markOnboarded(peakRef.current);
      if (window.history.length > 1) router.back();
      else router.push("/practice");
    } else setStep("chord");
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12 space-y-8">
      <nav aria-label="Setup steps">
        <ol className="flex items-center justify-center gap-2 sm:gap-3">
          {shownSteps.map((s, i) => (
            <li key={s.key} className="flex items-center gap-2">
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full border text-[11px] font-semibold ${
                  i < idx
                    ? "border-emerald-300/50 bg-emerald-300/15 text-emerald-100"
                    : i === idx
                    ? "border-amber-300/70 bg-amber-300/10 text-amber-100"
                    : "border-white/15 text-gray-500"
                }`}
                aria-current={i === idx ? "step" : undefined}
              >
                {i < idx ? "✓" : i + 1}
              </span>
              <span className={`hidden sm:inline text-xs ${i === idx ? "text-cream" : "text-gray-500"}`}>{s.label}</span>
              {i < STEPS.length - 1 && <span className="w-4 sm:w-8 h-px bg-white/10" aria-hidden />}
            </li>
          ))}
        </ol>
      </nav>

      <header className="text-center space-y-2">
        <p className="text-meta uppercase text-gray-500">
          Setup · step {idx + 1} of {STEPS.length}
        </p>
        <h1 ref={headingRef} tabIndex={-1} className="font-display text-h1 gradient-text outline-none" aria-live="polite">
          {meta.title}
        </h1>
      </header>

      <div className="glass-card min-h-[320px]">
        {step === "permission" && (
          <MicPermission onGranted={onGranted} onWithoutMic={() => finishTo(practiceHref)} />
        )}
        {step === "level" &&
          (analyser ? (
            <LevelCheck
              analyser={analyser}
              onPassed={(peak) => {
                peakRef.current = peak;
                setStep("tune");
              }}
            />
          ) : (
            <p className="text-center text-gray-400">Couldn&apos;t open audio in this browser.</p>
          ))}
        {step === "tune" &&
          (analyser ? (
            <Tuner analyser={analyser} sampleRate={sampleRate} onDone={afterTune} />
          ) : (
            <p className="text-center text-gray-400">Couldn&apos;t open audio in this browser.</p>
          ))}
        {step === "chord" && <FirstChord stream={stream} signedIn={signedIn} onFinished={() => markOnboarded(peakRef.current)} />}
      </div>

      <p className="text-center">
        <button
          type="button"
          onClick={() => finishTo(signedIn ? "/dashboard" : practiceHref)}
          className="text-sm text-gray-500 hover:text-gray-300 underline underline-offset-4 decoration-white/10"
        >
          Skip setup →
        </button>
      </p>
    </div>
  );
}
