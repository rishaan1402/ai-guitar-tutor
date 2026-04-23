"use client";

import { getCalendar } from "@/lib/api";
import useSWR from "swr";
import { ErrorState } from "@/components/ui/ErrorState";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function StreakHeatmap() {
  const { data, error } = useSWR("/api/progress/calendar", getCalendar, {
    revalidateOnFocus: false,
  });

  if (error) return <ErrorState message="Failed to load activity data" />;
  if (!data) return <div className="skeleton h-32 rounded" />;

  // Build a map: date string → {attempts, avg_score}
  const activityMap: Record<string, { attempts: number; avg_score: number }> = {};
  data.forEach(day => {
    activityMap[day.date] = { attempts: day.attempts, avg_score: day.avg_score };
  });

  // Generate 52 weeks × 7 days grid
  const today = new Date();
  const weeks: Array<Array<{ date: string; attempts: number; avg_score: number } | null>> = [];

  for (let w = 0; w < 52; w++) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(today);
      date.setDate(date.getDate() - (w * 7 + (6 - d)));
      const dateStr = date.toISOString().split("T")[0];
      const activity = activityMap[dateStr];
      week.push(activity ? { date: dateStr, ...activity } : null);
    }
    weeks.push(week);
  }

  // Intensity color based on attempts
  const getColor = (attempts: number): string => {
    if (attempts === 0) return "bg-gray-800/30";
    if (attempts < 2) return "bg-cyan-500/20 border-cyan-500/30";
    if (attempts < 4) return "bg-cyan-500/40 border-cyan-500/50";
    if (attempts < 6) return "bg-cyan-500/60 border-cyan-500/70";
    return "bg-cyan-500/80 border-cyan-500";
  };

  return (
    <div className="glass-card p-6 overflow-x-auto">
      <div className="flex gap-1 min-w-max">
        {weeks.map((week: any, w: number) => (
          <div key={w} className="flex flex-col gap-1">
            {week.map((day: any, d: number) => (
              <Tooltip key={d}>
                <TooltipTrigger
                  className={`w-3 h-3 rounded border border-gray-700 transition-all hover:scale-125 ${
                    day ? getColor(day.attempts) : "bg-gray-900/50"
                  }`}
                />

                {day && (
                  <TooltipContent side="top" className="text-xs">
                    <div>
                      {day.date}: {day.attempts} attempt{day.attempts !== 1 ? "s" : ""}
                    </div>
                    <div>Avg score: {(day.avg_score * 100).toFixed(0)}%</div>
                  </TooltipContent>
                )}
              </Tooltip>
            ))}
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-3 text-xs text-gray-400">
        <span>Less</span>
        <div className="flex gap-1">
          {[0, 1, 2, 3, 4].map(i => (
            <div key={i} className={`w-2 h-2 rounded ${getColor(i * 1.5)}`} />
          ))}
        </div>
        <span>More</span>
      </div>
    </div>
  );
}
