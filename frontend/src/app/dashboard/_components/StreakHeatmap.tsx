"use client";

import { getCalendar } from "@/lib/api";
import useSWR from "swr";
import { ErrorState } from "@/components/ui/ErrorState";
import { ActivityHeatmap } from "@/components/ActivityHeatmap";

export function StreakHeatmap() {
  const { data, error } = useSWR("/api/progress/calendar", getCalendar, {
    revalidateOnFocus: false,
  });

  if (error) return <ErrorState message="Failed to load activity data" />;
  if (!data) return <div className="skeleton h-48 rounded" />;

  return (
    <div className="glass-card p-6">
      <ActivityHeatmap days={data} />
    </div>
  );
}
