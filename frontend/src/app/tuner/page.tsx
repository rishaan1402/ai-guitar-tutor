"use client";

import dynamic from "next/dynamic";
import NavBar from "@/components/NavBar";

// Reuses the onboarding flow in tune-only mode (mic permission -> tuner).
// The flow and pitchy load on this route only.
const OnboardingFlow = dynamic(() => import("@/components/onboarding/OnboardingFlow"), {
  ssr: false,
  loading: () => (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8 sm:py-12" aria-busy="true">
      <div className="h-7" />
      <div className="space-y-2 text-center">
        <p className="label-mono text-cream/50">Tuner</p>
        <h1 className="font-display text-h1 uppercase text-cream">Tune up</h1>
      </div>
      <div className="min-h-[320px] rounded-[28px] border border-cream/10" />
    </div>
  ),
});

export default function TunerPage() {
  return (
    <main className="min-h-screen bg-ink-950">
      <NavBar />
      <OnboardingFlow tuneOnly />
    </main>
  );
}
