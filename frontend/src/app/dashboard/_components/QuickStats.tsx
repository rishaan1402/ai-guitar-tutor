"use client";

import { getProgress } from "@/lib/api";
import { StatCard } from "@/components/ui/StatCard";
import useSWR from "swr";

export function QuickStats() {
  const { data } = useSWR("/api/progress", getProgress, {
    revalidateOnFocus: false,
  });

  if (!data) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-20 rounded" />
        ))}
      </div>
    );
  }

  // Calculate some additional stats
  const totalAttempts = data.chords.reduce((sum: number, c: any) => sum + c.total_attempts, 0);
  const avgScore = data.chords.length
    ? data.chords.reduce((sum: number, c: any) => sum + c.best_score, 0) / data.chords.length
    : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        label="Chords Mastered"
        value={data.mastered_count}
        sub={`of ${data.total_attempted || 0} attempted`}
        accent="purple"
        icon="🎸"
      />
      <StatCard
        label="Total Attempts"
        value={totalAttempts}
        sub="across all chords"
        accent="cyan"
        icon="📊"
      />
      <StatCard
        label="Average Score"
        value={`${(avgScore * 100).toFixed(0)}%`}
        sub="current skill level"
        accent="green"
        icon="⭐"
      />
      <StatCard
        label="Day Streak"
        value={data.practice_streak}
        sub="consecutive days"
        accent="yellow"
        icon="🔥"
      />
    </div>
  );
}
