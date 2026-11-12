"use client";

import { formatChord } from "@/lib/chordName";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import {
  getMyAssignments,
  getMyTeachers,
  joinClass,
  leaveClass,
  type Assignment,
  type TeacherInfo,
} from "@/lib/api";

/** Student view of their class: join with a code, see assigned work, leave. */
export function MyClass() {
  const { user } = useAuth();
  const [teachers, setTeachers] = useState<TeacherInfo[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [code, setCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    const [t, a] = await Promise.all([getMyTeachers(), getMyAssignments()]);
    setTeachers(t);
    setAssignments(a);
  }, []);

  useEffect(() => {
    if (user?.role === "student") load().catch(() => {});
  }, [user, load]);

  if (!user || user.role !== "student") return null;

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoining(true);
    setMessage(null);
    try {
      const teacher = await joinClass(code.trim());
      setMessage({ ok: true, text: `You joined ${teacher.display_name}'s class.` });
      setCode("");
      await load();
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : "Could not join" });
    } finally {
      setJoining(false);
    }
  };

  const handleLeave = async (teacher: TeacherInfo) => {
    if (!window.confirm(`Leave ${teacher.display_name}'s class? They will no longer see your progress.`)) return;
    await leaveClass(teacher.id);
    await load();
  };

  return (
    <section>
      <h3 className="text-h3 mb-4">Your Class</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="glass-card">
        <h4 className="text-sm font-semibold text-white mb-3">Assigned to you</h4>
        {assignments.length === 0 ? (
          <p className="text-sm text-gray-500">
            {teachers.length ? "Nothing assigned yet." : "Join a class to get work from a teacher."}
          </p>
        ) : (
          <ul className="space-y-2">
            {assignments.map((a) => (
              <li key={a.id} className="flex items-start justify-between gap-3 text-sm">
                <div>
                  <p className="text-gray-200">
                    {a.chord_name ? formatChord(a.chord_name) : "Practice"}
                    <span className="text-gray-500"> · {a.teacher_name}</span>
                  </p>
                  {a.note && <p className="text-gray-400 text-xs mt-0.5">{a.note}</p>}
                </div>
                {a.chord_name && (
                  <Link
                    href={`/practice?chord=${encodeURIComponent(a.chord_name)}`}
                    className="shrink-0 text-purple-300 hover:text-purple-200 text-xs"
                  >
                    Practice →
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="glass-card">
        <h4 className="text-sm font-semibold text-white mb-3">Your class</h4>
        {teachers.length > 0 && (
          <ul className="space-y-1 mb-4">
            {teachers.map((t) => (
              <li key={t.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-300">{t.display_name}</span>
                <button
                  type="button"
                  onClick={() => handleLeave(t)}
                  className="text-xs text-gray-500 hover:text-red-300"
                >
                  Leave
                </button>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={handleJoin} className="flex gap-2">
          <label htmlFor="class-code" className="sr-only">Class code</label>
          <input
            id="class-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Class code"
            autoComplete="off"
            maxLength={16}
            required
            className="field-input font-mono tracking-widest flex-1"
          />
          <button type="submit" disabled={joining} className="btn-gradient px-4 py-2 text-sm">
            {joining ? "Joining…" : "Join"}
          </button>
        </form>
        {message && (
          <p className={`text-xs mt-2 ${message.ok ? "text-green-300" : "text-red-300"}`} role="status">
            {message.text}
          </p>
        )}
      </div>
    </div>
    </section>
  );
}
