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

      <select
        value={chordName}
        onChange={(e) => setChordName(e.target.value)}
        className="field-input"
      >
        {availableChords.map((c) => (
          <option key={c} value={c} className="bg-[#0a0a0e]">
            {c}
          </option>
        ))}
      </select>

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Optional note for the student…"
        rows={2}
        className="field-input resize-none"
      />

      {msg && (
        <p
          className={`text-sm px-3 py-2 rounded-lg border ${
            msg.includes("Assigned")
              ? "bg-green-500/10 border-green-500/30 text-green-300"
              : "bg-red-500/10 border-red-500/30 text-red-300"
          }`}
        >
          {msg}
        </p>
      )}

      <button type="submit" disabled={saving || !chordName} className="btn-gradient text-sm px-4 py-2">
        {saving ? "Assigning…" : "Assign Chord"}
      </button>
    </form>
  );
}
