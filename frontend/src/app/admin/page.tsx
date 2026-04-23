"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/context/AuthContext";
import UserManagement from "@/components/AdminPanel/UserManagement";
import SystemStatsView from "@/components/AdminPanel/SystemStats";
import { getAdminUsers, getSystemStats, type AdminUser, type SystemStats } from "@/lib/api";

export default function AdminPage() {
  const { user, loading, isAdmin } = useAuth();
  const router = useRouter();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      router.push("/");
    }
  }, [loading, user, isAdmin, router]);

  const fetchData = () => {
    if (!isAdmin) return;
    setLoadingData(true);
    Promise.all([
      getAdminUsers(page, 20, roleFilter || undefined).then(setUsers),
      getSystemStats().then(setStats).catch(() => {}),
    ]).finally(() => setLoadingData(false));
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, page, roleFilter]);

  const handleRoleChange = (userId: string, newRole: string) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
    );
  };

  if (loading || !user) {
    return (
      <AppShell>
        <span className="text-gray-400">Loading…</span>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-8">
        <h1 className="text-2xl font-bold text-white">Admin Panel</h1>

        {/* System stats */}
        {stats && <SystemStatsView stats={stats} />}

        {/* User management */}
        <div className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-300">User Management</h2>
            <div className="flex gap-2 items-center">
              <select
                value={roleFilter}
                onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
                className="bg-gray-800 text-white border border-gray-600 rounded px-2 py-1 text-xs focus:outline-none"
              >
                <option value="">All roles</option>
                <option value="student">Students</option>
                <option value="teacher">Teachers</option>
                <option value="admin">Admins</option>
              </select>
            </div>
          </div>

          {loadingData ? (
            <p className="text-gray-400 p-6">Loading…</p>
          ) : (
            <>
              <UserManagement users={users} onRoleChange={handleRoleChange} />
              {/* Pagination */}
              <div className="px-4 py-3 border-t border-gray-700 flex items-center gap-3">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="text-sm text-gray-400 hover:text-white disabled:text-gray-700 transition-colors"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-500">Page {page}</span>
                <button
                  disabled={users.length < 20}
                  onClick={() => setPage((p) => p + 1)}
                  className="text-sm text-gray-400 hover:text-white disabled:text-gray-700 transition-colors"
                >
                  Next
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
