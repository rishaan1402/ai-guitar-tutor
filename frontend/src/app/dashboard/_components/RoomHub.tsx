"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { useAuth } from "@/context/AuthContext";
import { getPlan, getProgress, type PlanItem } from "@/lib/api";
import { planTitle } from "@/lib/mastery";
import Room from "@/components/room/Room";
import type { RoomObjectId } from "@/components/room/roomObjects";
import { planHref } from "./TodaysPlan";

function greeting(hour: number): string {
  if (hour < 5) return "Late session";
  if (hour < 12) return "Morning";
  if (hour < 18) return "Afternoon";
  return "Evening";
}

const NEXT_COPY: Record<string, string> = {
  review: "Quick re-check — keep it solid.",
  focus: "One more clean day and it's on your wall.",
  new: "A new chord, just above where you are.",
  warmup: "Warm your hands up with one you know.",
  assignment: "Your teacher picked this one.",
  transition: "One-minute changes: switch until it's automatic.",
};

/** The signed-in home: one clear next step, then your room with your state on it. */
export function RoomHub() {
  const { user } = useAuth();
  const swrOpts = { revalidateOnFocus: false, revalidateOnReconnect: false };
  const { data: plan } = useSWR(user ? "/api/plan/next" : null, getPlan, swrOpts);
  const { data: progress } = useSWR(user ? "/api/progress" : null, getProgress, swrOpts);
  const [hour, setHour] = useState<number | null>(null);
  useEffect(() => setHour(new Date().getHours()), []);

  const items: PlanItem[] = plan?.items ?? [];
  const next = items[0];
  const chordItems = items.filter((i) => i.type !== "transition" && i.chord_symbol);
  const drill = items.find((i) => i.type === "transition");
  const due = items.filter((i) => i.type === "review").length;
  const syms = chordItems.map((i) => i.chord_symbol!).slice(0, 4);
  const pad = (a?: string, b?: string) => (a ? `| ${a} . | ${b ?? a} . |` : "| G . | D . |");

  const hrefs: Partial<Record<RoomObjectId, string>> = {};
  const blurbs: Partial<Record<RoomObjectId, string>> = {};
  const badges: Partial<Record<RoomObjectId, string>> = {};
  if (chordItems[0]) {
    hrefs.amp = planHref(chordItems[0]);
    blurbs.amp = `Up next: ${planTitle(chordItems[0])}.`;
    badges.amp = chordItems.length > 1 ? `${chordItems.length} today` : "1 today";
  }
  if (drill) {
    hrefs.metronome = planHref(drill);
    blurbs.metronome = planTitle(drill);
  }
  if (due) badges.wall = `${due} re-check${due > 1 ? "s" : ""}`;

  return (
    <section aria-labelledby="hub-title" className="space-y-8">
      <div className="grid items-end gap-6 lg:grid-cols-[1fr_auto]">
        <div>
          <p className="label-mono text-cream/50">
            {progress?.practice_streak ? `Day ${progress.practice_streak} streak · ` : ""}
            {progress ? `${progress.mastered_count} mastered` : " "}
          </p>
          <h1 id="hub-title" className="mt-2 font-display text-h1 uppercase text-cream">
            {hour === null ? "Welcome back" : greeting(hour)}, <span className="text-amber-400">{user?.display_name ?? "player"}.</span>
          </h1>
        </div>
        {next ? (
          <Link
            href={planHref(next)}
            className="group flex min-w-[min(100%,22rem)] items-center justify-between gap-6 rounded-[22px] bg-amber-400 px-6 py-5 text-ink-950 transition hover:bg-amber-300"
          >
            <span>
              <span className="label-mono block text-ink-950/60">Next up</span>
              <span className="mt-1 block font-display text-xl leading-tight">{planTitle(next)}</span>
              <span className="mt-1 block text-sm text-ink-950/70">{NEXT_COPY[next.type] ?? next.description}</span>
            </span>
            <span className="text-3xl transition-transform group-hover:translate-x-1" aria-hidden="true">→</span>
          </Link>
        ) : (
          <div className="h-[104px] min-w-[min(100%,22rem)] rounded-[22px] skeleton" aria-hidden="true" />
        )}
      </div>

      <Room
        state={{
          mastered: progress?.mastered_count ?? 0,
          streak: progress?.practice_streak ?? 0,
          sheet: [pad(syms[0], syms[1]), pad(syms[2] ?? syms[0], syms[3] ?? syms[1])],
          recheckDue: due > 0,
        }}
        hrefs={hrefs}
        blurbs={blurbs}
        badges={badges}
        showIndex={false}
      />
    </section>
  );
}
