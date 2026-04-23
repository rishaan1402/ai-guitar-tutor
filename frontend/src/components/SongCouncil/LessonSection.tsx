"use client";

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
          <span style={{ color: "#e2e8f0" }}>{title}</span>
        </span>
        <span
          className="text-xs transition-transform duration-200"
          style={{
            color: "rgba(255,255,255,0.4)",
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
          style={{ color: "rgba(255,255,255,0.75)", whiteSpace: "pre-wrap" }}
        >
          {content}
        </div>
      )}
    </div>
  );
}
