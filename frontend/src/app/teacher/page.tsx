"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/context/AuthContext";
import StudentList from "@/components/TeacherDashboard/StudentList";
import StudentDetail from "@/components/TeacherDashboard/StudentDetail";
import ClassAnalyticsView from "@/components/TeacherDashboard/ClassAnalytics";
import AssignmentForm from "@/components/TeacherDashboard/AssignmentForm";
import InviteCodeCard from "@/components/TeacherDashboard/InviteCodeCard";
import { SectionHeader } from "@/components/ui/SectionHeader";
import {
  getStudents,
  getClassAnalytics,
  listChords,
  removeStudent,
  type StudentSummary,
  type ClassAnalytics,
} from "@/lib/api";

export default function TeacherPage() {
  const { user, loading, isTeacher } = useAuth();
  const router = useRouter();

  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [analytics, setAnalytics] = useState<ClassAnalytics | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<StudentSummary | null>(null);
  const [availableChords, setAvailableChords] = useState<string[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [tab, setTab] = useState<"students" | "analytics">("students");

  useEffect(() => {
    if (!loading && (!user || !isTeacher)) {
      router.push("/dashboard");
    }
  }, [loading, user, isTeacher, router]);

  useEffect(() => {
    if (!isTeacher) return;
    setLoadingData(true);
    Promise.all([
      getStudents().then(setStudents),
      getClassAnalytics().then(setAnalytics).catch(() => {}),
      listChords().then((r) => setAvailableChords(r.chords)).catch(() => {}),
    ]).finally(() => setLoadingData(false));
  }, [isTeacher]);

  const handleRemove = async (student: StudentSummary) => {
    if (!window.confirm(`Remove ${student.display_name} from your class? You'll lose access to their progress.`)) return;
    await removeStudent(student.id);
    setSelectedStudent(null);
    setStudents((prev) => prev.filter((s) => s.id !== student.id));
  };

  // Students never see the teacher UI (no invite-code flash, no 403 fetch).
  if (loading || !user || !isTeacher) {
    return (
      <AppShell>
        <span className="text-gray-400">Loading…</span>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto">
        <SectionHeader as="h1" kicker="Your class" title="Teacher room" subtitle="Share your invite code, assign chords, and see who has mastered what." />

        <InviteCodeCard />

        {/* Tab switcher */}
        <div
          className="flex gap-1 mb-6 rounded-lg p-1 w-fit"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          {(["students", "analytics"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${
                tab === t
                  ? "bg-white/10 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {loadingData ? (
          <p className="text-gray-400">Loading…</p>
        ) : tab === "analytics" ? (
          analytics ? (
            <ClassAnalyticsView analytics={analytics} />
          ) : (
            <p className="text-gray-500">No analytics data yet.</p>
          )
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Student list */}
            <div className="lg:col-span-1 panel overflow-hidden">
              <div className="px-4 py-3 panel-header">
                <h2 className="text-sm font-semibold text-gray-300">
                  Students ({students.length})
                </h2>
              </div>
              <StudentList
                students={students}
                onSelect={setSelectedStudent}
                selectedId={selectedStudent?.id ?? null}
              />
            </div>

            {/* Detail panel */}
            <div className="lg:col-span-2 space-y-6">
              {selectedStudent ? (
                <>
                  <div className="glass-card">
                    <StudentDetail student={selectedStudent} />
                    <button
                      type="button"
                      onClick={() => handleRemove(selectedStudent)}
                      className="mt-6 text-xs text-gray-500 hover:text-red-300"
                    >
                      Remove from class
                    </button>
                  </div>
                  {availableChords.length > 0 && (
                    <div className="glass-card">
                      <AssignmentForm
                        student={selectedStudent}
                        availableChords={availableChords}
                      />
                    </div>
                  )}
                </>
              ) : (
                <div className="panel p-12 text-center text-gray-500">
                  {students.length
                    ? "Select a student to view their progress"
                    : "No students yet. Share your class code above so students can join."}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
