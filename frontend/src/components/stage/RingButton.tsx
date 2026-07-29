"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  href?: string;
  onClick?: () => void;
  size?: number;
  className?: string;
}

/**
 * Circular call-to-action: a disc with a thin outer ring whose arc draws
 * itself on hover/focus. Used for the one main action on a stage.
 */
export default function RingButton({ label, href, onClick, size = 132, className }: Props) {
  const r = 48;
  const c = 2 * Math.PI * r;
  const inner = (
    <>
      <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full -rotate-90" aria-hidden>
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(243,234,216,0.14)" strokeWidth="0.6" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="#efc27a"
          strokeWidth="0.9"
          strokeLinecap="round"
          strokeDasharray={c}
          className="[stroke-dashoffset:var(--off)] group-hover:[stroke-dashoffset:0] group-focus-visible:[stroke-dashoffset:0] transition-[stroke-dashoffset] duration-[1100ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
          style={{ ["--off" as string]: `${c * 0.78}` }}
        />
      </svg>
      <span
        className="absolute rounded-full border border-cream/40 bg-moss-900/40 backdrop-blur-sm transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:bg-amber-400 group-hover:border-amber-300 group-hover:scale-[1.04]"
        style={{ inset: size * 0.13 }}
        aria-hidden
      />
      <span className="relative z-10 max-w-[70%] text-center text-[10.5px] font-bold uppercase leading-tight tracking-[0.18em] text-cream transition-colors duration-300 group-hover:text-[#1c1206]">
        {label}
      </span>
    </>
  );

  const cls = cn("group relative inline-flex items-center justify-center rounded-full shrink-0 outline-none", className);
  const style = { width: size, height: size };

  if (href) {
    return (
      <Link href={href} className={cls} style={style}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls} style={style}>
      {inner}
    </button>
  );
}
