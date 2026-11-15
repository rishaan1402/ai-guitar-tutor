"use client";

/** "Play along": each section of the chart (or the whole song) on the highway with a band. */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Sheet } from "@/lib/chordpro";
import { songGrooves } from "@/lib/groove/fromChart";
import { grooveHref } from "@/lib/groove/link";
import { getProgress } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";
import { prettySymbol } from "@/lib/chordShape";

const BEGINNER = ["Em", "Am", "E", "A", "D", "G", "C", "Dm"];
const SUFFIX: [string, string][] = [["_half_dim7", "m7b5"], ["_dominant7", "7"], ["_major7", "maj7"], ["_minor7", "m7"], ["_power", "5"], ["_major", ""], ["_minor", "m"]];
const keyToSymbol = (k: string) => {
  for (const [suf, q] of SUFFIX) if (k.endsWith(suf)) return k.slice(0, -suf.length) + q;
  return k;
};

export default function PlayAlong({ sheet }: { sheet: Sheet }) {
  const [easy, setEasy] = useState(false);
  const [known, setKnown] = useState<Set<string>>(new Set(BEGINNER));

  // chords you've played well; beginners get the first eight
  useEffect(() => {
    if (!getAccessToken()) return;
    getProgress()
      .then((p) => {
        const mine = p.chords.filter((c) => c.best_score >= 0.75).map((c) => keyToSymbol(c.chord_name));
        if (mine.length >= 3) setKnown(new Set(mine));
      })
      .catch(() => {});
  }, []);

  const parts = useMemo(() => songGrooves(sheet, { known, easy }), [sheet, known, easy]);
  if (!parts.length) return null;
  const swaps = parts[0].changed;

  return (
    <section aria-labelledby="playalong" className="rounded-2xl border border-amber-400/25 bg-amber-400/[0.04] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="playalong" className="font-semibold text-white">Play along</h2>
          <p className="text-sm text-gray-400">On the highway with a band. The music follows you.</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-200">
          <input type="checkbox" checked={easy} onChange={(e) => setEasy(e.target.checked)} className="h-4 w-4 accent-amber-400" />
          Easy version (chords I know)
        </label>
      </div>
      {easy && swaps.length > 0 && (
        <p className="mt-2 text-xs text-amber-200/80">
          Swapped: {swaps.slice(0, 6).map((s) => s.split("→").map(prettySymbol).join(" → ")).join(" · ")}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {parts.map((p) => (
          <Link
            key={p.groove.id}
            href={grooveHref(p.groove)}
            className={`inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm ${p.groove.id === "song-all" ? "bg-amber-400 font-semibold text-gray-900" : "border border-white/15 text-gray-100 hover:bg-white/5"}`}
          >
            ▶ {p.label}
          </Link>
        ))}
      </div>
    </section>
  );
}
