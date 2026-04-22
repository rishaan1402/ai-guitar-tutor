"use client";

import { useState } from "react";
import { assignChord, type StudentSummary } from "@/lib/api";

interface Props {
  student: StudentSummary;
  availableChords: string[];
}

export default function AssignmentForm({ student, availableChords }: Props) {
  const [chordName, setChordName] = useState(availableChords[0] || "");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      await assignChord({ student_id: student.id, chord_name: chordName, note: note || undefined });
      setMsg(`Assigned "${chordName}" to ${student.display_name}`);
      setNote("");
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : "Assignment failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-300">
        Assign Chord to {student.display_name}
      </h3>

      <div className="flex gap-2">
        <select
          value={chordName}
          onChange={(e) => setChordName(e.target.value)}
          className="flex-1 bg-gray-800 text-white border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
        >
          {availableChords.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Optional note for the student…"
        rows={2}
        className="w-full bg-gray-800 text-white border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 resize-none"
      />

      {msg && (
        <p
          className={`text-sm px-3 py-2 rounded-lg ${
            msg.includes("Assigned")
              ? "bg-green-900/20 border border-green-800 text-green-400"
              : "bg-red-900/20 border border-red-800 text-red-400"
          }`}
        >
          {msg}
        </p>
      )}

      <button
        type="submit"
        disabled={saving || !chordName}
        className="bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
      >
        {saving ? "Assigning…" : "Assign Chord"}
      </button>
    </form>
  );
}
