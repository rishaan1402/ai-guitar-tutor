"use client";

import type { ProgressData } from "@/lib/progress";
import { getProgressSummary } from "@/lib/progress";

interface Props {
  progress: ProgressData;
  totalChords: number;
}

export default function ProgressDashboard({ progress, totalChords }: Props) {
  const { totalPracticed, averageBestScore, streak, masteredCount } = getProgressSummary(progress);

  if (totalPracticed === 0) {
    return (
      <div className="glass-card text-center py-6 px-4">
        <p className="text-gray-300 font-medium">Welcome! Select a chord below to start your first lesson.</p>
        <p className="text-gray-500 text-sm mt-1">Your progress will appear here after your first session.</p>
      </div>
    );
  }

  const stats = [
    {
      label: "Practiced",
      value: `${totalPracticed}/${totalChords}`,
      sub: "chords",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
        </svg>
      ),
      color: "text-purple-400",
    },
    {
      label: "Mastered",
      value: String(masteredCount),
      sub: "chords",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: "text-green-400",
    },
    {
      label: "Avg Score",
      value: `${Math.round(averageBestScore * 100)}%`,
      sub: "best",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
        </svg>
      ),
      color: "text-cyan-400",
    },
    {
      label: "Streak",
      value: String(streak),
      sub: streak === 1 ? "day" : "days",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1A3.75 3.75 0 0012 18z" />
        </svg>
      ),
      color: "text-orange-400",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {stats.map((s) => (
        <div key={s.label} className="glass-card text-center p-4 flex flex-col items-center gap-2">
          <div className={s.color}>{s.icon}</div>
          <div className="text-xl font-bold text-white">{s.value}</div>
          <div className="text-xs text-gray-400">
            {s.label} <span className="text-gray-500">{s.sub}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
