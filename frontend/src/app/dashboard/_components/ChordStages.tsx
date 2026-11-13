"use client";

import Link from "next/link";
import useSWR from "swr";
import { getProgress, type ChordProgressItem } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import StageChip from "@/components/StageChip";
import { formatChord } from "@/lib/chordName";

const ORDER: Record<string, number> = { due: 0, verifying: 1, learning: 2, mastered: 3, new: 4 };

/** Each practised chord with its mastery stage; re-checks due first. Shares QuickStats' SWR key. */
export function ChordStages() {
  const { user } = useAuth();
  const { data } = useSWR(user ? "/api/progress" : null, getProgress, { revalidateOnFocus: false });
  if (!data) return <div className="skeleton min-h-[72px] rounded-2xl" aria-hidden />;
  const chords = data.chords
    .filter((c: ChordProgressItem) => c.total_attempts > 0)
    .sort((a, b) => (ORDER[a.stage] ?? 9) - (ORDER[b.stage] ?? 9))
    .slice(0, 12);
  if (!chords.length) {
    return <p className="text-sm text-gray-400">Practise a chord and its progress shows up here.</p>;
  }
  return (
    <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2" data-testid="chord-stages">
      {chords.map((c) => (
        <li key={c.chord_name}>
          <Link
            href={`/practice?chord=${encodeURIComponent(c.chord_name)}`}
            className="glass rounded-xl px-3 py-2 flex items-center justify-between gap-3 hover:border-white/20 transition-colors duration-fast"
          >
            <span className="text-sm font-semibold text-cream truncate">{formatChord(c.chord_name)}</span>
            <StageChip item={c} />
          </Link>
        </li>
      ))}
    </ul>
  );
}
