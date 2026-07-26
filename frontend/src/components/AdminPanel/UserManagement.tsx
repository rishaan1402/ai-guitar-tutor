"use client";

import { useState } from "react";
import { updateUserRole, type AdminUser } from "@/lib/api";

interface Props {
  users: AdminUser[];
  onRoleChange: (userId: string, newRole: string) => void;
}

const ROLES = ["student", "teacher", "admin"];

const ROLE_COLORS: Record<string, string> = {
  admin: "text-red-400",
  teacher: "text-blue-400",
  student: "text-green-400",
};

export default function UserManagement({ users, onRoleChange }: Props) {
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const handleRoleChange = async (userId: string, role: string) => {
    setUpdatingId(userId);
    try {
      await updateUserRole(userId, role);
      onRoleChange(userId, role);
    } catch {
      // silently ignore — UI stays consistent
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="panel-row-border">
            <th className="text-left py-3 px-4 text-gray-400 font-medium">Name</th>
            <th className="text-left py-3 px-4 text-gray-400 font-medium">Email</th>
            <th className="text-left py-3 px-4 text-gray-400 font-medium">Level</th>
            <th className="text-left py-3 px-4 text-gray-400 font-medium">Role</th>
            <th className="text-left py-3 px-4 text-gray-400 font-medium">Joined</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="panel-row-border panel-row-hover transition-colors">
              <td className="py-3 px-4 font-medium text-white">{u.display_name}</td>
              <td className="py-3 px-4 text-gray-400">{u.email}</td>
              <td className="py-3 px-4 capitalize text-gray-300">{u.skill_level}</td>
              <td className="py-3 px-4">
                <select
                  value={u.role}
                  disabled={updatingId === u.id}
                  onChange={(e) => handleRoleChange(u.id, e.target.value)}
                  className={`bg-white/5 border border-white/10 rounded px-2 py-1 text-xs focus:outline-none focus:border-purple-500/50 ${
                    ROLE_COLORS[u.role] ?? "text-gray-300"
                  }`}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r} className="bg-[#0a0a0e] text-gray-200">
                      {r}
                    </option>
                  ))}
                </select>
              </td>
              <td className="py-3 px-4 text-gray-500 text-xs">
                {new Date(u.created_at).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
