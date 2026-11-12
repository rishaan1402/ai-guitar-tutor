"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  href?: string;
  onClick?: () => void;
  size?: number;
  className?: string;
  disabled?: boolean;
  /** "Live" state (e.g. recording): ring fully drawn and the disc lit. */
  active?: boolean;
  /** Accessible name when it should differ from the visible label. */
  ariaLabel?: string;
  ariaPressed?: boolean;
  /** Extra line under the label (e.g. a timer or key hint). */
  sublabel?: string;
}

/**
 * Circular call-to-action: a disc with a thin outer ring whose arc draws
 * itself on hover/focus. Used for the one main action on a stage.
 */
export default function RingButton({
  label,
  href,
  onClick,
  size = 132,
  className,
  disabled,
  active,
  ariaLabel,
  ariaPressed,
  sublabel,
}: Props) {
  const r = 48;
  const c = 2 * Math.PI * r;
  const labelPx = Math.max(10.5, Math.round(size * 0.08 * 10) / 10);
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
          strokeWidth={active ? 1.6 : 0.9}
          strokeLinecap="round"
          strokeDasharray={c}
          className={cn(
            "transition-[stroke-dashoffset] duration-[1100ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
            active
              ? "[stroke-dashoffset:0]"
              : "[stroke-dashoffset:var(--off)] group-hover:[stroke-dashoffset:0] group-focus-visible:[stroke-dashoffset:0]",
          )}
          style={{ ["--off" as string]: `${c * 0.78}` }}
        />
      </svg>
      <span
        className={cn(
          "absolute rounded-full border backdrop-blur-sm transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
          active
            ? "bg-amber-400/90 border-amber-300 motion-safe:animate-pulse"
            : "border-cream/40 bg-moss-900/40",
          !disabled && !active && "group-hover:bg-amber-400 group-hover:border-amber-300 group-hover:scale-[1.04]",
        )}
        style={{ inset: size * 0.13 }}
        aria-hidden
      />
      <span
        className={cn(
          "relative z-10 max-w-[70%] text-center font-bold uppercase leading-tight tracking-[0.18em] transition-colors duration-300",
          active ? "text-[#1c1206]" : "text-cream",
          !disabled && !active && "group-hover:text-[#1c1206]",
        )}
        style={{ fontSize: labelPx }}
      >
        {label}
        {sublabel && (
          <span className="block mt-1 text-[0.8em] font-medium tracking-[0.08em] normal-case opacity-80 tabular-nums">
            {sublabel}
          </span>
        )}
      </span>
    </>
  );

  const cls = cn(
    "group relative inline-flex items-center justify-center rounded-full shrink-0 outline-none",
    "focus-visible:ring-2 focus-visible:ring-amber-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
    disabled && "opacity-40 cursor-not-allowed",
    className,
  );
  const style = { width: size, height: size };

  if (href) {
    return (
      <Link href={href} className={cls} style={style} aria-label={ariaLabel}>
        {inner}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={cls}
      style={style}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-pressed={ariaPressed}
    >
      {inner}
    </button>
  );
}
