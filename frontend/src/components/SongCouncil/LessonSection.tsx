"use client";

import RichText from "@/components/ui/RichText";
import React, { useState } from "react";

interface LessonSectionProps {
  title: string;
  icon: string;
  content: string;
  defaultOpen?: boolean;
}

/**
 * Collapsible lesson section with prose content
 * Displays content with pre-wrap to preserve formatting
 */
export function LessonSection({ title, icon, content, defaultOpen = false }: LessonSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="glass-card overflow-hidden transition-all duration-300">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-white/5 transition-colors"
      >
        <span className="flex items-center gap-3 font-semibold text-sm">
          <span className="text-lg">{icon}</span>
          <span style={{ color: "rgb(var(--text-muted))" }}>{title}</span>
        </span>
        <span
          className="text-xs transition-transform duration-200"
          style={{
            color: "rgba(var(--cream-rgb),0.4)",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            display: "inline-block",
          }}
        >
          ▼
        </span>
      </button>
      {open && (
        <div
          className="px-4 pb-4 text-sm leading-relaxed animate-in fade-in-50 duration-200"
          style={{ color: "rgba(var(--cream-rgb),0.75)" }}
        >
          <RichText text={content} />
        </div>
      )}
    </div>
  );
}
