"use client";

import type { WeeklyReport } from "@/lib/api";
import { prettySymbol } from "@/lib/chordShape";
import ReportContent from "@/components/report/ReportContent";

export default function WeeklyCard({ report }: { report: WeeklyReport }) {
  const s = report.stats;
  const tiles: [string, string][] = [
    ["Days played", String(s.active_days)],
    ["Clean takes", String(s.clean_takes)],
    ["Grooves", `${s.grooves} · ${s.groove_stars}★`],
    ["On-time changes", s.on_time_rate === null ? "–" : `${Math.round(s.on_time_rate * 100)}%`],
  ];
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {tiles.map(([k, v]) => (
          <div key={k} className="rounded-2xl border border-cream/10 p-3">
            <p className="label-mono text-[10px] text-cream/45">{k}</p>
            <p className="mt-1 font-display text-2xl text-cream">{v}</p>
          </div>
        ))}
      </div>
      {s.new_mastered.length > 0 && <p className="text-sm text-sage-200">New on your wall: {s.new_mastered.map(prettySymbol).join(", ")}</p>}
      <div className="rounded-2xl border border-cream/10 bg-cream/[0.03] p-4">
        <p className="label-mono text-amber-400">From your coach</p>
        <p className="mt-2 text-[15px] leading-relaxed text-cream/85">{report.summary}</p>
        <ReportContent kind="tip" content={report.summary} className="mt-2 block" />
      </div>
    </div>
  );
}
