"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { getPlan } from "@/lib/api";
import { cardEntrance, staggerContainer } from "@/lib/motion";
import { ErrorState } from "@/components/ui/ErrorState";
import useSWR from "swr";

const ITEM_ICONS: Record<string, string> = {
  warmup:     "🔥",
  focus:      "🎯",
  new:        "⭐",
  transition: "↔️",
};

const ITEM_COLORS: Record<string, string> = {
  warmup:     "border-green-500/30 bg-green-500/5",
  focus:      "border-orange-500/30 bg-orange-500/5",
  new:        "border-purple-500/30 bg-purple-500/5",
  transition: "border-cyan-500/30 bg-cyan-500/5",
};

export function TodaysPlan() {
  const { data, error, isLoading } = useSWR("/api/plan/next", getPlan, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });

  if (error) return <ErrorState message="Failed to load today's plan" />;
  if (isLoading) return <div className="skeleton h-32 rounded" />;
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
      {data.items.map((item: any, i: number) => (
        <PlanItemCard key={i} item={item} index={i} />
      ))}
    </motion.div>
  );
}

interface PlanItemCardProps {
  item: any;
  index: number;
}

function PlanItemCard({ item, index }: PlanItemCardProps) {
  const icon = ITEM_ICONS[item.type] || "📝";
  const colors = ITEM_COLORS[item.type] || "border-gray-500/30 bg-gray-500/5";

  let actionHref = "/";
  let actionLabel = "Start";
  let actionDesc = "";

  if (item.type === "warmup" || item.type === "focus" || item.type === "new") {
    actionHref = `/?chord=${encodeURIComponent(item.chord_key || "")}`;
    actionLabel = "Practice";
    actionDesc = `${item.chord_symbol} ${item.best_score ? `(${(item.best_score * 100).toFixed(0)}%)` : ""}`;
  } else if (item.type === "transition") {
    actionHref = `/?mode=transitions`;
    actionLabel = "Drill";
    actionDesc = `${item.chord_a_symbol} → ${item.chord_b_symbol}`;
  }

  return (
    <motion.div
      variants={cardEntrance}
      initial="hidden"
      animate="visible"
      transition={{ delay: index * 0.05 }}
    >
      <Link href={actionHref}>
        <div className={`glass-card border cursor-pointer hover:border-white/20 transition-all ${colors} group`}>
          <div className="flex items-start justify-between mb-3">
            <span className="text-3xl">{icon}</span>
            <span className="text-xs text-gray-500 uppercase font-mono">{item.type}</span>
          </div>
          <h4 className="font-semibold text-white mb-1">{item.description}</h4>
          {actionDesc && <p className="text-sm text-gray-400 mb-3">{actionDesc}</p>}
          <div className="flex items-center gap-2 text-xs text-purple-300 group-hover:text-purple-200 font-medium">
            {actionLabel}
            <span>→</span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
