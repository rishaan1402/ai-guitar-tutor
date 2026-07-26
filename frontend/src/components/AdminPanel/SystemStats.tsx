"use client";

import { type SystemStats } from "@/lib/api";

interface Props {
  stats: SystemStats;
}

export default function SystemStats({ stats }: Props) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="glass-card">
        <p className="text-gray-400 text-xs mb-1">Total Users</p>
        <p className="text-2xl font-bold text-white">{stats.total_users}</p>
      </div>
      <div className="glass-card">
        <p className="text-gray-400 text-xs mb-1">Chord Attempts</p>
        <p className="text-2xl font-bold text-purple-400">{stats.total_chord_attempts}</p>
      </div>
      <div className="glass-card">
        <p className="text-gray-400 text-xs mb-1">Transition Drills</p>
        <p className="text-2xl font-bold text-cyan-400">{stats.total_transition_drills}</p>
      </div>
      <div className="glass-card">
        <p className="text-gray-400 text-xs mb-2">Users by Role</p>
        <div className="space-y-1">
          {Object.entries(stats.users_by_role).map(([role, count]) => (
            <div key={role} className="flex items-center justify-between text-xs">
              <span className="capitalize text-gray-300">{role}</span>
              <span className="font-medium text-white">{count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
