"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CalendarDay } from "@/lib/api";
import { activityMap, buildHeatmapWeeks } from "@/lib/heatmap";

const CELL = 12;
const GAP = 3;

function colorFor(attempts: number): string {
  if (attempts === 0) return "bg-white/[0.04] border-white/[0.06]";
  if (attempts < 2) return "bg-cyan-500/25 border-cyan-500/30";
  if (attempts < 4) return "bg-cyan-500/45 border-cyan-500/50";
  if (attempts < 6) return "bg-cyan-500/65 border-cyan-500/70";
  return "bg-cyan-400/90 border-cyan-300";
}

function prettyDate(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

interface Tip {
  x: number;
  y: number;
  text: string;
}

/**
 * GitHub-style year of practice. One labelled image for assistive tech, plain
 * (non-focusable) cells, and a single pointer tooltip shared by every cell.
 */
export function ActivityHeatmap({ days, today }: { days: CalendarDay[]; today?: Date }) {
  const weeks = useMemo(() => buildHeatmapWeeks(activityMap(days), today), [days, today]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<Tip | null>(null);

  const visibleKeys = useMemo(() => new Set(weeks.flatMap((w) => w.days.map((d) => d.date))), [weeks]);
  const practiced = days.filter((d) => d.attempts > 0 && visibleKeys.has(d.date));
  const practiceDays = practiced.length;
  const totalAttempts = practiced.reduce((s, d) => s + d.attempts, 0);
  const summary =
    practiceDays === 0
      ? "No practice recorded in the last year yet"
      : `${practiceDays} practice day${practiceDays === 1 ? "" : "s"} and ${totalAttempts} attempt${
          totalAttempts === 1 ? "" : "s"
        } in the last year`;

  // Newest week is on the right; show it first on narrow screens.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [weeks]);

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const target = (e.target as HTMLElement).closest<HTMLElement>("[data-date]");
    const box = scrollRef.current?.getBoundingClientRect();
    if (!target || !box) return setTip(null);
    const r = target.getBoundingClientRect();
    const attempts = Number(target.dataset.attempts || 0);
    const avg = Number(target.dataset.avg || 0);
    const text =
      `${prettyDate(target.dataset.date!)}: ` +
      (attempts ? `${attempts} attempt${attempts === 1 ? "" : "s"}, avg ${Math.round(avg * 100)}%` : "no practice");
    setTip({ x: r.left - box.left + r.width / 2, y: r.top - box.top, text });
  }

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        className="overflow-x-auto pb-1"
        tabIndex={0}
        aria-label="Activity heatmap (scrolls horizontally)"
        onPointerMove={onPointerMove}
        onPointerLeave={() => setTip(null)}
      >
        <div role="img" aria-label={summary} className="inline-block min-w-max">
          {/* Month labels */}
          <div className="flex text-[10px] text-gray-500 mb-1 h-3" aria-hidden>
            {weeks.map((w, i) => (
              <div key={i} style={{ width: CELL + GAP }} className="shrink-0 overflow-visible whitespace-nowrap">
                {w.monthLabel ?? ""}
              </div>
            ))}
          </div>
          <div className="flex" style={{ gap: GAP }} aria-hidden>
            {weeks.map((w, i) => (
              <div key={i} className="flex flex-col" style={{ gap: GAP }}>
                {w.days.map((d) => (
                  <div
                    key={d.date}
                    data-date={d.isFuture ? undefined : d.date}
                    data-attempts={d.attempts}
                    data-avg={d.avg_score}
                    data-testid="heatmap-cell"
                    style={{ width: CELL, height: CELL }}
                    className={
                      d.isFuture
                        ? "rounded-[3px] opacity-0"
                        : `rounded-[3px] border ${colorFor(d.attempts)} ${
                            d.isToday ? "ring-1 ring-amber-300 ring-offset-1 ring-offset-transparent" : ""
                          }`
                    }
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {tip && (
        <div
          className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border border-white/10 bg-moss-900/95 px-2 py-1 text-[11px] text-cream shadow-lg"
          style={{ left: tip.x, top: tip.y - 6 }}
          aria-hidden
        >
          {tip.text}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-gray-400">
        <span>{summary}</span>
        <span className="flex items-center gap-1.5" aria-hidden>
          Less
          {[0, 1, 3, 5, 7].map((n) => (
            <span key={n} className={`inline-block w-2.5 h-2.5 rounded-[2px] border ${colorFor(n)}`} />
          ))}
          More
        </span>
      </div>
    </div>
  );
}
