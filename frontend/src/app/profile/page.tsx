"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/context/AuthContext";
import { updateProfile, getProgress, deleteAccount, type ProgressResponse } from "@/lib/api";
import { SectionHeader } from "@/components/ui/SectionHeader";

const SKILL_LEVELS = ["beginner", "intermediate", "advanced"];

export default function ProfilePage() {
  const { user, loading, refresh } = useAuth();
  const router = useRouter();

  const [displayName, setDisplayName] = useState("");
  const [skillLevel, setSkillLevel] = useState("beginner");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProgressResponse | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteAccount(deletePassword);
      // Drop local copies too, so nothing re-uploads into a future account
      for (const key of ["guitar-tutor-progress", "guitar-tutor-transitions", "guitar_tutor_migrated"]) {
        localStorage.removeItem(key);
      }
      // Full reload to "/" so the signed-out redirect to /login doesn't win the race
      window.location.assign("/");
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : "Could not delete account");
      setDeleting(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="text-gray-400">Loading…</span>
      </div>
    );
  }

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto space-y-6">
        <SectionHeader title="Your Profile" subtitle="Manage your account and see how practice is going" />

        {/* Edit form */}
        <div className="glass-card">
          <h2 className="text-lg font-semibold text-white mb-4">Account Settings</h2>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="field-label">Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                className="field-input"
              />
            </div>

            <div>
              <label className="field-label">Skill Level</label>
              <select
                value={skillLevel}
                onChange={(e) => setSkillLevel(e.target.value)}
                className="field-input"
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
              <label className="field-label">Email</label>
              <p className="text-gray-400 text-sm">{user.email}</p>
            </div>

            <div>
              <label className="field-label">Role</label>
              <p className="text-gray-400 text-sm capitalize">{user.role}</p>
            </div>

            {saveMsg && (
              <p
                className={`text-sm px-3 py-2 rounded-lg border ${
                  saveMsg.includes("updated")
                    ? "bg-green-500/10 border-green-500/30 text-green-300"
                    : "bg-red-500/10 border-red-500/30 text-red-300"
                }`}
              >
                {saveMsg}
              </p>
            )}

            <button type="submit" disabled={saving} className="btn-gradient py-2 px-4">
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </form>
        </div>

        {/* Progress summary */}
        {progress && (
          <div className="glass-card">
            <h2 className="text-lg font-semibold text-white mb-4">Practice Stats</h2>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-purple-400">{progress.total_attempted}</p>
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
                      <div className="flex-1 bg-white/5 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${c.mastered ? "bg-green-500" : "bg-purple-500"}`}
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
        {/* Danger zone */}
        <div className="glass-card border border-red-500/20">
          <h2 className="text-lg font-semibold text-white mb-1">Delete account</h2>
          <p className="text-sm text-gray-400 mb-4">
            Permanently deletes your account and all practice history. This can&apos;t be undone.
          </p>
          {confirmingDelete ? (
            <form onSubmit={handleDelete} className="space-y-3">
              <div>
                <label htmlFor="delete-password" className="field-label">Enter your password to confirm</label>
                <input
                  id="delete-password"
                  type="password"
                  autoComplete="current-password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  required
                  className="field-input"
                />
              </div>
              {deleteError && (
                <p className="text-red-300 text-sm bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                  {deleteError}
                </p>
              )}
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={deleting}
                  className="py-2 px-4 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-medium disabled:opacity-50"
                >
                  {deleting ? "Deleting…" : "Delete permanently"}
                </button>
                <button
                  type="button"
                  onClick={() => { setConfirmingDelete(false); setDeletePassword(""); setDeleteError(null); }}
                  className="py-2 px-4 rounded-lg border border-white/10 text-gray-300 text-sm hover:bg-white/5"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className="py-2 px-4 rounded-lg border border-red-500/40 text-red-300 text-sm hover:bg-red-500/10"
            >
              Delete my account
            </button>
          )}
        </div>
      </div>
    </AppShell>
  );
}
