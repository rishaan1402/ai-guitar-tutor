"use client";

import { useEffect, useState } from "react";
import { getStudentProgress, getStudentReport, type StudentSummary, type StudentProgress } from "@/lib/api";

interface Props {
  student: StudentSummary;
}

export default function StudentDetail({ student }: Props) {
  const [progress, setProgress] = useState<StudentProgress | null>(null);
  const [report, setReport] = useState<string | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(true);
  const [loadingReport, setLoadingReport] = useState(false);

  useEffect(() => {
    setProgress(null);
    setReport(null);
    setLoadingProgress(true);
    getStudentProgress(student.id)
      .then(setProgress)
      .catch(() => setProgress(null))
      .finally(() => setLoadingProgress(false));
  }, [student.id]);

  const handleGenerateReport = async () => {
    setLoadingReport(true);
    try {
      const data = await getStudentReport(student.id);
      setReport(data.report);
    } catch {
      setReport("Failed to generate report. Please try again.");
    } finally {
      setLoadingReport(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">{student.display_name}</h2>
          <p className="text-gray-400 text-sm">{student.email} · {student.skill_level}</p>
        </div>
        <button
          onClick={handleGenerateReport}
          disabled={loadingReport}
          className="btn-gradient text-sm px-4 py-2"
        >
          {loadingReport ? "Generating…" : "AI Report"}
        </button>
      </div>

      {report && (
        <div className="rounded-xl p-4 border border-purple-500/30 bg-purple-500/10">
          <h3 className="text-sm font-semibold text-purple-300 mb-2">AI Progress Report</h3>
          <p className="text-gray-200 text-sm leading-relaxed whitespace-pre-line">{report}</p>
        </div>
      )}

      {loadingProgress ? (
        <p className="text-gray-500 text-sm">Loading progress…</p>
      ) : progress ? (
        <div>
          <h3 className="text-sm font-medium text-gray-300 mb-3">Chord Progress</h3>
          {progress.chords.length === 0 ? (
            <p className="text-gray-500 text-sm">No chord attempts yet.</p>
          ) : (
            <div className="space-y-2">
              {progress.chords.map((c) => (
                <div key={c.chord_name} className="flex items-center gap-3">
                  <span className="text-sm text-gray-300 w-20 font-mono">{c.chord_name}</span>
                  <div className="flex-1 bg-white/5 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${c.mastered ? "bg-green-500" : "bg-purple-500"}`}
                      style={{ width: `${Math.round(c.best_score * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-400 w-12 text-right">
                    {Math.round(c.best_score * 100)}%
                  </span>
                  <span className="text-xs text-gray-500 w-16 text-right">
                    {c.total_attempts} tries
                  </span>
                  {c.mastered && <span className="text-green-400 text-xs">✓</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <p className="text-gray-500 text-sm">Could not load progress.</p>
      )}
    </div>
  );
}
