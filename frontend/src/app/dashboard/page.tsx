"use client";

import { Suspense } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { TodaysPlan } from "./_components/TodaysPlan";
import { StreakHeatmap } from "./_components/StreakHeatmap";
import { QuickStats } from "./_components/QuickStats";
import { LoadingSkeleton, CardSkeleton, StatCardSkeleton } from "@/components/ui/LoadingSkeleton";
import { SectionHeader } from "@/components/ui/SectionHeader";

export default function DashboardPage() {
  return (
    <AppShell>
      <div className="space-y-8">
        {/* Header */}
        <SectionHeader
          title="Your Practice Hub"
          subtitle="Pick up where you left off and stay on track"
        />

        {/* Today's Plan */}
        <section>
          <h3 className="text-h3 mb-4">Today's Plan</h3>
          <Suspense fallback={<CardSkeleton />}>
            <TodaysPlan />
          </Suspense>
        </section>

        {/* Quick Stats */}
        <section>
          <h3 className="text-h3 mb-4">Your Progress</h3>
          <Suspense
            fallback={
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <StatCardSkeleton key={i} />
                ))}
              </div>
            }
          >
            <QuickStats />
          </Suspense>
        </section>

        {/* Streak Heatmap */}
        <section>
          <h3 className="text-h3 mb-4">365-Day Activity</h3>
          <Suspense fallback={<div className="skeleton h-48 rounded" />}>
            <StreakHeatmap />
          </Suspense>
        </section>
      </div>
    </AppShell>
  );
}
