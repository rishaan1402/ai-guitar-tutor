"use client";

import { getProgress } from "@/lib/api";
import { StatCard } from "@/components/ui/StatCard";
import useSWR from "swr";
import { useAuth } from "@/context/AuthContext";

export function QuickStats() {
  const { user } = useAuth();
  const { data } = useSWR(user ? "/api/progress" : null, getProgress, {
    revalidateOnFocus: false,
  });

  if (!data) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" aria-hidden>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton min-h-[106px] rounded-2xl" />
        ))}
      </div>
    );
  }

  // Calculate some additional stats
  const totalAttempts = data.chords.reduce((sum: number, c: any) => sum + c.total_attempts, 0);
  // A true mean of each chord's best take (the old tile summed bests and called it an average).
  const graded = data.chords.filter((c: any) => typeof c.best_score === "number");
  const bestMean = graded.length
    ? graded.reduce((sum: number, c: any) => sum + c.best_score, 0) / graded.length
    : null;

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
        label="Avg best score"
        value={bestMean === null ? "—" : `${(bestMean * 100).toFixed(0)}%`}
        sub={bestMean === null ? "no graded takes yet" : "mean of each chord's best take"}
        accent={bestMean === null || bestMean === 0 ? "neutral" : "green"}
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
