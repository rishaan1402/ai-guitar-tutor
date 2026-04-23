"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { AppShell } from "@/components/layout/AppShell";
import { getChordHistory } from "@/lib/api";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { fadeInUp, staggerContainer } from "@/lib/motion";
import useSWR from "swr";

function ChordDetailContent({ chordName }: { chordName: string }) {
  const { data, error } = useSWR(
    `/api/progress/chord/${chordName}/history`,
    () => getChordHistory(chordName)
  );

  if (error) {
    return (
      <div className="space-y-4">
        <ErrorState message="Failed to load chord history" />
        <div className="text-center">
          <Link href="/progress" className="text-purple-300 hover:text-purple-200 transition-colors">
            ← Back to Progress
          </Link>
        </div>
      </div>
    );
  }

  if (!data) return <LoadingSkeleton />;

  const attempts = data;
  if (attempts.length === 0) {
    return (
      <div className="glass-card p-6 text-center">
        <p className="text-gray-400">No attempts recorded for this chord yet.</p>
      </div>
    );
  }

  // Calculate statistics
  const scores = attempts.map((a) => a.score);
  const bestScore = Math.max(...scores);
  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
  const latestScore = scores[scores.length - 1];

  // Most common missing notes
  const missingNoteFreq: Record<string, number> = {};
  attempts.forEach((attempt) => {
    attempt.missing_notes.forEach((note) => {
      missingNoteFreq[note] = (missingNoteFreq[note] || 0) + 1;
    });
  });

  const topMissingNotes = Object.entries(missingNoteFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Most common issues
  const issueFreq: Record<string, number> = {};
  attempts.forEach((attempt) => {
    if (attempt.issue) {
      issueFreq[attempt.issue] = (issueFreq[attempt.issue] || 0) + 1;
    }
  });

  const topIssues = Object.entries(issueFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  return (
    <motion.div
      className="space-y-6"
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      {/* Stats cards */}
      <motion.div variants={fadeInUp} className="grid grid-cols-3 gap-4">
        <div className="glass-card p-4">
          <p className="text-xs text-gray-400 uppercase">Best Score</p>
          <p className="text-3xl font-bold text-green-400 mt-2">{(bestScore * 100).toFixed(0)}%</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-xs text-gray-400 uppercase">Average Score</p>
          <p className="text-3xl font-bold text-yellow-400 mt-2">{(avgScore * 100).toFixed(0)}%</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-xs text-gray-400 uppercase">Latest Score</p>
          <p className="text-3xl font-bold text-cyan-400 mt-2">{(latestScore * 100).toFixed(0)}%</p>
        </div>
      </motion.div>

      {/* Score trend chart */}
      <motion.div variants={fadeInUp} className="glass-card p-6">
        <SectionHeader title="Score Trend" subtitle="Your performance over time" />
        <div className="flex items-end gap-1 h-32 mt-4">
          {attempts.map((attempt, idx) => (
            <div
              key={idx}
              className="flex-1 rounded-t transition-all hover:opacity-80 group relative"
              style={{
                height: `${attempt.score * 100}%`,
                background:
                  attempt.score >= 0.8
                    ? "rgba(34,197,94,0.6)"
                    : attempt.score >= 0.5
                    ? "rgba(234,179,8,0.6)"
                    : "rgba(239,68,68,0.6)",
              }}
              title={`Attempt ${idx + 1}: ${(attempt.score * 100).toFixed(0)}%`}
            />
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-4">
          {attempts.length} total attempt{attempts.length > 1 ? "s" : ""} •{" "}
          {Math.round((scores.filter((s) => s >= 0.8).length / scores.length) * 100)}% mastery rate
        </p>
      </motion.div>

      {/* Common issues */}
      {topIssues.length > 0 && (
        <motion.div variants={fadeInUp} className="glass-card p-6">
          <SectionHeader title="Common Issues" subtitle="What to focus on improving" />
          <div className="space-y-2 mt-4">
            {topIssues.map(([issue, count]) => (
              <div key={issue} className="flex items-center justify-between p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <span className="text-sm text-gray-300">{issue}</span>
                <span className="text-xs font-semibold text-red-300">{count} times</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Most commonly missed notes */}
      {topMissingNotes.length > 0 && (
        <motion.div variants={fadeInUp} className="glass-card p-6">
          <SectionHeader title="Most Commonly Missed Notes" subtitle="Notes to practice more" />
          <div className="flex flex-wrap gap-2 mt-4">
            {topMissingNotes.map(([note, count]) => (
              <span
                key={note}
                className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold"
                style={{
                  background: "rgba(239,68,68,0.2)",
                  border: "1px solid rgba(239,68,68,0.4)",
                  color: "#fca5a5",
                }}
              >
                {note} <span className="text-xs ml-1 opacity-70">({count}x)</span>
              </span>
            ))}
          </div>
        </motion.div>
      )}

      {/* Detailed attempt timeline */}
      <motion.div variants={fadeInUp} className="glass-card p-6">
        <SectionHeader title="Attempt Timeline" subtitle="Complete history of this chord" />
        <div className="space-y-2 mt-4 max-h-96 overflow-y-auto">
          {attempts
            .slice()
            .reverse()
            .map((attempt, idx) => (
              <div
                key={idx}
                className="p-3 rounded-lg border"
                style={{
                  background:
                    attempt.score >= 0.8
                      ? "rgba(34,197,94,0.1)"
                      : attempt.score >= 0.5
                      ? "rgba(234,179,8,0.1)"
                      : "rgba(239,68,68,0.1)",
                  borderColor:
                    attempt.score >= 0.8
                      ? "rgba(34,197,94,0.3)"
                      : attempt.score >= 0.5
                      ? "rgba(234,179,8,0.3)"
                      : "rgba(239,68,68,0.3)",
                }}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      Attempt #{attempts.length - idx}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(attempt.created_at).toLocaleDateString()} at{" "}
                      {new Date(attempt.created_at).toLocaleTimeString()}
                    </p>
                  </div>
                  <span
                    className="text-lg font-bold px-2 py-1 rounded"
                    style={{
                      color:
                        attempt.score >= 0.8
                          ? "#86efac"
                          : attempt.score >= 0.5
                          ? "#fcd34d"
                          : "#fca5a5",
                    }}
                  >
                    {(attempt.score * 100).toFixed(0)}%
                  </span>
                </div>

                {/* Notes summary */}
                {(attempt.missing_notes.length > 0 || attempt.extra_notes.length > 0) && (
                  <div className="mt-2 space-y-1">
                    {attempt.missing_notes.length > 0 && (
                      <p className="text-xs text-red-300">
                        Missing: {attempt.missing_notes.join(", ")}
                      </p>
                    )}
                    {attempt.extra_notes.length > 0 && (
                      <p className="text-xs text-yellow-300">Extra: {attempt.extra_notes.join(", ")}</p>
                    )}
                  </div>
                )}

                {/* Feedback or issue */}
                {attempt.issue && (
                  <p className="text-xs text-yellow-300 mt-2">Issue: {attempt.issue}</p>
                )}
                {attempt.feedback_text && (
                  <p className="text-xs text-gray-300 mt-2 italic">{attempt.feedback_text}</p>
                )}
              </div>
            ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function ChordDetailPage() {
  const params = useParams();
  const router = useRouter();
  const chordName = params.name as string;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <AppShell>
        <LoadingSkeleton />
      </AppShell>
    );
  }

  const decodedChordName = decodeURIComponent(chordName);

  return (
    <AppShell>
      <motion.div
        className="max-w-4xl mx-auto space-y-6"
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
      >
        <motion.div variants={fadeInUp} className="flex items-center gap-4">
          <Link href="/progress" className="text-gray-400 hover:text-white transition-colors">
            ← Back to Progress
          </Link>
          <h1 className="text-3xl font-bold gradient-text">{decodedChordName}</h1>
        </motion.div>

        <Suspense fallback={<LoadingSkeleton />}>
          <ChordDetailContent chordName={decodedChordName} />
        </Suspense>
      </motion.div>
    </AppShell>
  );
}
