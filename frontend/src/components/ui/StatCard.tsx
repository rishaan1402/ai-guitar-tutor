"use client";
import { motion } from "framer-motion";
import { cardEntrance } from "@/lib/motion";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon?: React.ReactNode;
  accent?: "purple" | "cyan" | "green" | "yellow" | "red";
  className?: string;
}

const accentMap = {
  purple: "text-purple-400",
  cyan:   "text-cyan-400",
  green:  "text-green-400",
  yellow: "text-yellow-400",
  red:    "text-red-400",
};

export function StatCard({ label, value, sub, icon, accent = "purple", className }: StatCardProps) {
  return (
    <motion.div
      variants={cardEntrance}
      initial="hidden"
      animate="visible"
      className={cn(
        "glass-card flex flex-col gap-1 min-w-0",
        className
      )}
    >
      <div className="flex items-center gap-2 text-gray-400 text-sm">
        {icon && <span className={accentMap[accent]}>{icon}</span>}
        <span>{label}</span>
      </div>
      <div className={cn("text-2xl font-bold", accentMap[accent])}>{value}</div>
      {sub && <div className="text-xs text-gray-500">{sub}</div>}
    </motion.div>
  );
}
