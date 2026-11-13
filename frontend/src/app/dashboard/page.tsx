"use client";

import { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import { TodaysPlan } from "./_components/TodaysPlan";
import { StreakHeatmap } from "./_components/StreakHeatmap";
import { QuickStats } from "./_components/QuickStats";
import { MyClass } from "./_components/MyClass";
import { MasteryBanner } from "./_components/MasteryBanner";
import { ChordStages } from "./_components/ChordStages";
import { RoomHub } from "./_components/RoomHub";
import { CardSkeleton, StatCardSkeleton } from "@/components/ui/LoadingSkeleton";

function Heading({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div className="mb-5">
      <p className="label-mono text-cream/45">{kicker}</p>
      <h2 className="mt-1 font-display text-h3 uppercase tracking-tight text-cream">{title}</h2>
    </div>
  );
}

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  // Signed-out visitors go to login before any data fetch (the widgets wait on `user`).
  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  return (
    <AppShell>
      <div className="space-y-16 pb-10">
        <RoomHub />

        <section>
          <Heading kicker="Today" title="Your plan" />
          <Suspense fallback={<CardSkeleton />}>
            <TodaysPlan />
          </Suspense>
        </section>

        <section>
          <Heading kicker="On your wall" title="Your chords" />
          <Suspense
            fallback={
              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <StatCardSkeleton key={i} />
                ))}
              </div>
            }
          >
            <QuickStats />
          </Suspense>
          <div className="mb-3 mt-6">
            <MasteryBanner />
          </div>
          <ChordStages />
        </section>

        {/* Teacher assignments + class membership (signed-in students only) */}
        <MyClass />

        <section>
          <Heading kicker="Every day you played" title="Activity" />
          <Suspense fallback={<div className="skeleton h-48 rounded" />}>
            <StreakHeatmap />
          </Suspense>
        </section>
      </div>
    </AppShell>
  );
}
