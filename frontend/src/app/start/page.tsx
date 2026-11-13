"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import NavBar from "@/components/NavBar";

// The flow (and pitchy, inside the tuner) loads on this route only.
const OnboardingFlow = dynamic(() => import("@/components/onboarding/OnboardingFlow"), {
  ssr: false,
  loading: () => <FlowSkeleton />,
});

function FlowSkeleton() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12 space-y-8" aria-busy="true">
      <div className="h-7" />
      <div className="text-center space-y-2">
        <p className="text-meta uppercase text-gray-500">Setup</p>
        <h1 className="font-display text-h1 gradient-text">Let me hear your guitar</h1>
      </div>
      <div className="glass-card min-h-[320px]" />
    </div>
  );
}

function WithStep() {
  const params = useSearchParams();
  return <OnboardingFlow tuneOnly={params.get("step") === "tune"} />;
}

export default function StartPage() {
  return (
    <main className="min-h-screen">
      <NavBar />
      <Suspense fallback={<FlowSkeleton />}>
        <WithStep />
      </Suspense>
    </main>
  );
}
