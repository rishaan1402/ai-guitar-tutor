"use client";

import { type StudentSummary } from "@/lib/api";

interface Props {
  students: StudentSummary[];
  onSelect: (student: StudentSummary) => void;
  selectedId: string | null;
}

export default function StudentList({ students, onSelect, selectedId }: Props) {
  if (students.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        No students enrolled yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-700">
            <th className="text-left py-3 px-4 text-gray-400 font-medium">Name</th>
            <th className="text-left py-3 px-4 text-gray-400 font-medium">Level</th>
            <th className="text-right py-3 px-4 text-gray-400 font-medium">Attempts</th>
            <th className="text-right py-3 px-4 text-gray-400 font-medium">Mastered</th>
            <th className="text-right py-3 px-4 text-gray-400 font-medium">Avg Score</th>
            <th className="text-right py-3 px-4 text-gray-400 font-medium">Last Active</th>
          </tr>
        </thead>
        <tbody>
          {students.map((s) => (
            <tr
              key={s.id}
              onClick={() => onSelect(s)}
              className={`border-b border-gray-800 cursor-pointer hover:bg-gray-800 transition-colors ${
                selectedId === s.id ? "bg-gray-800" : ""
              }`}
            >
              <td className="py-3 px-4">
                <div className="font-medium text-white">{s.display_name}</div>
                <div className="text-gray-500 text-xs">{s.email}</div>
              </td>
              <td className="py-3 px-4 capitalize text-gray-300">{s.skill_level}</td>
              <td className="py-3 px-4 text-right text-gray-300">{s.total_attempts}</td>
              <td className="py-3 px-4 text-right text-green-400">{s.mastered_count}</td>
              <td className="py-3 px-4 text-right text-gray-300">
                {Math.round(s.avg_score * 100)}%
              </td>
              <td className="py-3 px-4 text-right text-gray-500 text-xs">
                {s.last_active ? new Date(s.last_active).toLocaleDateString() : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
