"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { getPlan, type PlanItem } from "@/lib/api";
import { planTitle } from "@/lib/mastery";
import { cardEntrance, staggerContainer } from "@/lib/motion";
import { ErrorState } from "@/components/ui/ErrorState";
import useSWR from "swr";
import { useAuth } from "@/context/AuthContext";

const ITEM_COLORS: Record<string, string> = {
  warmup:     "border-emerald-300/25 bg-emerald-300/[0.04]",
  focus:      "border-amber-300/30 bg-amber-300/[0.04]",
  review:     "border-amber-300/40 bg-amber-300/[0.06]",
  assignment: "border-cream/25 bg-cream/[0.04]",
  new:        "border-white/10 bg-white/[0.02]",
  transition: "border-emerald-300/20 bg-emerald-300/[0.03]",
};

const ITEM_EYEBROW: Record<string, string> = {
  warmup: "Warm-up",
  focus: "Focus",
  review: "Re-check",
  assignment: "Assigned",
  new: "New chord",
  transition: "Changes",
};

export function TodaysPlan() {
  const { user } = useAuth();
  // No fetch until we know who is signed in (no 401 before the login redirect).
  const { data, error, isLoading } = useSWR(user ? "/api/plan/next" : null, getPlan, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });

  if (error) return <ErrorState message="Failed to load today's plan" />;
  // Same footprint as the final cards so nothing below shifts when they land.
  if (isLoading || !user)
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" aria-hidden>
        {/* The planner returns four items (warm-up, focus, new, transition) */}
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton min-h-[166px] rounded-2xl" />
        ))}
      </div>
    );
  if (!data || !data.items || data.items.length === 0) {
    return (
      <div className="glass-card text-center py-8">
        <p className="text-gray-400">No practice items for today. Come back tomorrow!</p>
      </div>
    );
  }

  return (
    <motion.div
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      {data.items.map((item: PlanItem, i: number) => (
        <PlanItemCard key={i} item={item} index={i} />
      ))}
    </motion.div>
  );
}

interface PlanItemCardProps {
  item: PlanItem;
  index: number;
}

/** Deep link for a plan item: chords open that chord's lesson, changes open the trainer. */
export function planHref(item: PlanItem): string {
  if (item.type === "transition") return "/practice?mode=transitions";
  return item.chord_key ? `/practice?chord=${encodeURIComponent(item.chord_key)}` : "/practice";
}

function PlanItemCard({ item, index }: PlanItemCardProps) {
  const colors = ITEM_COLORS[item.type] || "border-white/10 bg-white/[0.02]";
  const actionLabel = item.type === "transition" ? "Drill" : item.type === "review" ? "Re-check" : "Practice";
  const detail =
    item.type === "transition"
      ? item.reason || item.description
      : item.type === "assignment" && item.note
      ? item.note
      : item.best_score
      ? `Best so far ${(item.best_score * 100).toFixed(0)}%`
      : item.description;

  return (
    <motion.div
      variants={cardEntrance}
      initial="hidden"
      animate="visible"
      transition={{ delay: index * 0.06 }}
    >
      <Link href={planHref(item)} className="block h-full">
        <div className={`glass-card h-full border cursor-pointer hover:border-white/20 transition-all duration-fast ${colors} group`}>
          <p className="text-meta uppercase text-gray-500 mb-3">{ITEM_EYEBROW[item.type] ?? item.type}</p>
          <h4 className="font-display text-h3 text-cream mb-1">{planTitle(item)}</h4>
          {detail && <p className="text-sm text-gray-400 mb-3">{detail}</p>}
          <div className="flex items-center gap-2 text-xs text-amber-200 group-hover:text-amber-100 font-medium">
            {actionLabel}
            <span aria-hidden>→</span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
