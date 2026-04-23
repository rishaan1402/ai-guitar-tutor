"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/context/AuthContext";
import StudentList from "@/components/TeacherDashboard/StudentList";
import StudentDetail from "@/components/TeacherDashboard/StudentDetail";
import ClassAnalyticsView from "@/components/TeacherDashboard/ClassAnalytics";
import AssignmentForm from "@/components/TeacherDashboard/AssignmentForm";
import {
  getStudents,
  getClassAnalytics,
  listChords,
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
      router.push("/");
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

  if (loading || !user) {
    return (
      <AppShell>
        <span className="text-gray-400">Loading…</span>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-6">Teacher Dashboard</h1>

        {/* Tab switcher */}
        <div className="flex gap-1 mb-6 bg-gray-800 rounded-lg p-1 w-fit">
          {(["students", "analytics"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${
                tab === t
                  ? "bg-gray-600 text-white"
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
            <div className="lg:col-span-1 bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-700">
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
                  <div className="bg-gray-900 border border-gray-700 rounded-xl p-6">
                    <StudentDetail student={selectedStudent} />
                  </div>
                  {availableChords.length > 0 && (
                    <div className="bg-gray-900 border border-gray-700 rounded-xl p-6">
                      <AssignmentForm
                        student={selectedStudent}
                        availableChords={availableChords}
                      />
                    </div>
                  )}
                </>
              ) : (
                <div className="bg-gray-900 border border-gray-700 rounded-xl p-12 text-center text-gray-500">
                  Select a student to view their progress
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
