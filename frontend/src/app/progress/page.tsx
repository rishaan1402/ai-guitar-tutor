"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/context/AuthContext";
import { getProgress, getCalendar } from "@/lib/api";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";
import { fadeInUp, staggerContainer } from "@/lib/motion";
import useSWR from "swr";

function CalendarHeatmap() {
  const { data, error } = useSWR("/api/progress/calendar", getCalendar);

  if (error) return <ErrorState message="Failed to load calendar data" />;
  if (!data) return <LoadingSkeleton />;

  // Build activity map
  const activityMap: Record<string, { attempts: number; avg_score: number }> = {};
  data.forEach((day) => {
    activityMap[day.date] = { attempts: day.attempts, avg_score: day.avg_score };
  });

  // Generate 52 weeks × 7 days
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

  const getColor = (attempts: number): string => {
    if (attempts === 0) return "bg-gray-800/30";
    if (attempts < 2) return "bg-cyan-500/20 border-cyan-500/30";
    if (attempts < 4) return "bg-cyan-500/40 border-cyan-500/50";
    if (attempts < 6) return "bg-cyan-500/60 border-cyan-500/70";
    return "bg-cyan-500/80 border-cyan-500";
  };

  return (
    <div className="glass-card p-6 overflow-x-auto">
      <SectionHeader title="365-Day Activity Heatmap" subtitle="Your practice consistency over the past year" />
      <div className="flex gap-1 min-w-max mt-4">
        {weeks.map((week: any, w: number) => (
          <div key={w} className="flex flex-col gap-1">
            {week.map((day: any, d: number) => (
              <div
                key={d}
                title={
                  day
                    ? `${day.date}: ${day.attempts} attempts, ${(day.avg_score * 100).toFixed(0)}%`
                    : ""
                }
                className={`w-3 h-3 rounded border border-gray-700 transition-all hover:scale-125 ${
                  day ? getColor(day.attempts) : "bg-gray-900/50"
                }`}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-3 text-xs text-gray-400">
        <span>Less</span>
        <div className="flex gap-1">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className={`w-2 h-2 rounded ${getColor(i * 1.5)}`} />
          ))}
        </div>
        <span>More</span>
      </div>
    </div>
  );
}

function SkillMeter({ skillLevel }: { skillLevel: string }) {
  const levels = ["beginner", "intermediate", "advanced"];
  const currentIndex = levels.indexOf(skillLevel);

  return (
    <div className="glass-card p-6">
      <SectionHeader title="Skill Level" subtitle="Your current playing ability" />
      <div className="flex items-center gap-3 mt-6">
        {levels.map((level, idx) => (
          <div key={level} className="flex-1">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${
                idx <= currentIndex
                  ? "bg-gradient-to-r from-purple-500 to-cyan-500"
                  : "bg-gray-700"
              }`}
            />
            <p className="text-xs text-gray-400 mt-2 capitalize text-center">{level}</p>
          </div>
        ))}
      </div>
      <p className="text-sm text-gray-300 mt-6">
        You're playing at a <span className="font-bold capitalize">{skillLevel}</span> level.{" "}
        {currentIndex < levels.length - 1
          ? "Master more advanced chords to level up!"
          : "You've reached the highest level!"}
      </p>
    </div>
  );
}

function ChordMasteryMatrix({ chords }: { chords: any[] }) {
  return (
    <div className="glass-card p-6">
      <SectionHeader
        title="Chord Mastery Matrix"
        subtitle="Performance overview across all practiced chords"
      />
      <div className="mt-6 grid grid-cols-auto gap-2 max-h-96 overflow-y-auto">
        {chords.map((chord) => (
          <Link
            key={chord.chord_name}
            href={`/progress/chord/${encodeURIComponent(chord.chord_name)}`}
          >
            <div
              className="glass-card p-3 rounded-lg hover:scale-105 transition-all cursor-pointer border"
              style={{
                borderColor:
                  chord.best_score >= 0.8
                    ? "rgba(34,197,94,0.5)"
                    : chord.best_score >= 0.5
                    ? "rgba(234,179,8,0.5)"
                    : "rgba(239,68,68,0.5)",
                background:
                  chord.best_score >= 0.8
                    ? "rgba(34,197,94,0.1)"
                    : chord.best_score >= 0.5
                    ? "rgba(234,179,8,0.1)"
                    : "rgba(239,68,68,0.1)",
              }}
            >
              <p className="font-semibold text-sm text-white">{chord.chord_name}</p>
              <p className="text-xs text-gray-400 mt-1">{Math.round(chord.best_score * 100)}%</p>
              <p className="text-xs text-gray-500 mt-0.5">{chord.total_attempts} attempts</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function StatsOverview() {
  const { data } = useSWR("/api/progress", getProgress);

  if (!data) return <LoadingSkeleton />;

  const totalAttempts = data.chords.reduce((sum: number, c: any) => sum + c.total_attempts, 0);
  const avgScore = data.chords.length
    ? data.chords.reduce((sum: number, c: any) => sum + c.best_score, 0) / data.chords.length
    : 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="glass-card p-4">
        <p className="text-xs text-gray-400 uppercase">Chords Mastered</p>
        <p className="text-3xl font-bold gradient-text mt-2">{data.mastered_count}</p>
        <p className="text-xs text-gray-500 mt-1">of {data.total_attempted}</p>
      </div>
      <div className="glass-card p-4">
        <p className="text-xs text-gray-400 uppercase">Total Attempts</p>
        <p className="text-3xl font-bold text-cyan-400 mt-2">{totalAttempts}</p>
        <p className="text-xs text-gray-500 mt-1">across all chords</p>
      </div>
      <div className="glass-card p-4">
        <p className="text-xs text-gray-400 uppercase">Average Score</p>
        <p className="text-3xl font-bold text-green-400 mt-2">{(avgScore * 100).toFixed(0)}%</p>
        <p className="text-xs text-gray-500 mt-1">current skill level</p>
      </div>
      <div className="glass-card p-4">
        <p className="text-xs text-gray-400 uppercase">Practice Streak</p>
        <p className="text-3xl font-bold text-yellow-400 mt-2">{data.practice_streak}</p>
        <p className="text-xs text-gray-500 mt-1">consecutive days</p>
      </div>
    </div>
  );
}

export default function ProgressPage() {
  const { user, loading } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || loading) {
    return (
      <AppShell>
        <div className="max-w-6xl mx-auto space-y-8">
          <LoadingSkeleton />
        </div>
      </AppShell>
    );
  }

  if (!user) {
    return (
      <AppShell>
        <div className="max-w-6xl mx-auto space-y-4">
          <ErrorState message="Please log in to view your progress" />
          <div className="text-center">
            <Link href="/dashboard" className="text-purple-300 hover:text-purple-200 transition-colors">
              Go to Dashboard →
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <motion.div
        className="max-w-6xl mx-auto space-y-8"
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
      >
        <motion.div variants={fadeInUp}>
          <h1 className="text-3xl font-bold gradient-text">Your Progress</h1>
          <p className="text-gray-400 mt-2">Track your journey to guitar mastery</p>
        </motion.div>

        <motion.div variants={fadeInUp}>
          <Suspense fallback={<LoadingSkeleton />}>
            <StatsOverview />
          </Suspense>
        </motion.div>

        <motion.div variants={fadeInUp} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-3">
            <Suspense fallback={<LoadingSkeleton />}>
              <CalendarHeatmap />
            </Suspense>
          </div>
        </motion.div>

        <motion.div variants={fadeInUp} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Suspense fallback={<LoadingSkeleton />}>
            <SkillMeter skillLevel={user.skill_level} />
          </Suspense>
        </motion.div>

        <motion.div variants={fadeInUp} className="space-y-4">
          <SectionHeader title="All Practiced Chords" subtitle="Click any chord to see detailed history" />
          <Suspense fallback={<LoadingSkeleton />}>
            <ProgressContent />
          </Suspense>
        </motion.div>
      </motion.div>
    </AppShell>
  );
}

function ProgressContent() {
  const { data } = useSWR("/api/progress", getProgress);

  if (!data) return <LoadingSkeleton />;

  return <ChordMasteryMatrix chords={data.chords} />;
}
