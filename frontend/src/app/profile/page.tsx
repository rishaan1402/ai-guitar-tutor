"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/context/AuthContext";
import { updateProfile, getProgress, type ProgressResponse } from "@/lib/api";

const SKILL_LEVELS = ["beginner", "intermediate", "advanced"];

export default function ProfilePage() {
  const { user, loading, refresh } = useAuth();
  const router = useRouter();

  const [displayName, setDisplayName] = useState("");
  const [skillLevel, setSkillLevel] = useState("beginner");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProgressResponse | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
    if (user) {
      setDisplayName(user.display_name);
      setSkillLevel(user.skill_level);
      getProgress()
        .then(setProgress)
        .catch(() => {});
    }
  }, [user, loading, router]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveMsg(null);
    try {
      await updateProfile({ display_name: displayName, skill_level: skillLevel });
      await refresh();
      setSaveMsg("Profile updated!");
    } catch (err: unknown) {
      setSaveMsg(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <span className="text-gray-400">Loading…</span>
      </div>
    );
  }

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-8">Your Profile</h1>

        {/* Edit form */}
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 mb-8">
          <h2 className="text-lg font-semibold text-white mb-4">Account Settings</h2>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-300 mb-1">Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                className="w-full bg-gray-800 text-white border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-300 mb-1">Skill Level</label>
              <select
                value={skillLevel}
                onChange={(e) => setSkillLevel(e.target.value)}
                className="w-full bg-gray-800 text-white border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              >
                {SKILL_LEVELS.map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {lvl.charAt(0).toUpperCase() + lvl.slice(1)}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                AI feedback adapts to your skill level
              </p>
            </div>

            <div>
              <label className="block text-sm text-gray-300 mb-1">Email</label>
              <p className="text-gray-400 text-sm">{user.email}</p>
            </div>

            <div>
              <label className="block text-sm text-gray-300 mb-1">Role</label>
              <p className="text-gray-400 text-sm capitalize">{user.role}</p>
            </div>

            {saveMsg && (
              <p
                className={`text-sm px-3 py-2 rounded-lg ${
                  saveMsg.includes("updated")
                    ? "bg-green-900/20 border border-green-800 text-green-400"
                    : "bg-red-900/20 border border-red-800 text-red-400"
                }`}
              >
                {saveMsg}
              </p>
            )}

            <button
              type="submit"
              disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
            >
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </form>
        </div>

        {/* Progress summary */}
        {progress && (
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Practice Stats</h2>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-indigo-400">{progress.total_attempted}</p>
                <p className="text-xs text-gray-400 mt-1">Total Attempts</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-400">{progress.mastered_count}</p>
                <p className="text-xs text-gray-400 mt-1">Chords Mastered</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-yellow-400">{progress.practice_streak}</p>
                <p className="text-xs text-gray-400 mt-1">Day Streak</p>
              </div>
            </div>

            {progress.chords.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-300 mb-3">Chord Progress</h3>
                <div className="space-y-2">
                  {progress.chords.slice(0, 10).map((c) => (
                    <div key={c.chord_name} className="flex items-center gap-3">
                      <span className="text-sm text-gray-300 w-16 font-mono">{c.chord_name}</span>
                      <div className="flex-1 bg-gray-700 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${c.mastered ? "bg-green-500" : "bg-indigo-500"}`}
                          style={{ width: `${Math.round(c.best_score * 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-400 w-10 text-right">
                        {Math.round(c.best_score * 100)}%
                      </span>
                      {c.mastered && <span className="text-green-400 text-xs">✓</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
