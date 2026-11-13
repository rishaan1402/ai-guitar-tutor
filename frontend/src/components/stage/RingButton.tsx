"use client";

import Link from "next/link";
import type { Ref } from "react";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  href?: string;
  onClick?: () => void;
  size?: number;
  className?: string;
  disabled?: boolean;
  /**
   * "ghost" (default): transparent disc whose arc draws on hover — landing CTAs.
   * "primary": the one action on a step (Record) — filled amber at rest.
   */
  variant?: "primary" | "ghost";
  /** "Live" state (e.g. recording): ring fully drawn and the disc lit. */
  active?: boolean;
  /** Mic open and waiting for the strum: dark disc, pulsing ring. */
  listening?: boolean;
  /** While active: fraction of time remaining (1 → 0), drawn as the arc. */
  progress?: number;
  /** Accessible name when it should differ from the visible label. */
  ariaLabel?: string;
  ariaPressed?: boolean;
  /** Extra line under the label (e.g. a timer or key hint). */
  sublabel?: string;
  buttonRef?: Ref<HTMLButtonElement>;
}

/**
 * Circular call-to-action: a disc with a thin outer ring. Used for the one
 * main action on a stage.
 */
export default function RingButton({
  label,
  href,
  onClick,
  size = 132,
  className,
  disabled,
  variant = "ghost",
  active,
  listening,
  progress,
  ariaLabel,
  ariaPressed,
  sublabel,
  buttonRef,
}: Props) {
  const r = 48;
  const c = 2 * Math.PI * r;
  const labelPx = Math.max(10.5, Math.round(size * 0.08 * 10) / 10);
  const primary = variant === "primary";
  const live = active || listening;
  // Primary at rest: the whole ring is drawn. Active with a progress value: the arc is the time left.
  const arcOffset =
    active && typeof progress === "number" ? c * (1 - Math.max(0, Math.min(1, progress))) : primary || live ? 0 : null;

  const discClass = primary
    ? live
      ? "bg-[#14110c]/90 border-amber-300/50"
      : "bg-amber-400 border-amber-200 shadow-[0_0_32px_rgba(239,194,122,0.28)]"
    : active
    ? "bg-amber-400/90 border-amber-300 motion-safe:animate-pulse"
    : "border-cream/40 bg-moss-900/40";
  const labelClass = primary ? (live ? "text-cream" : "text-[#1c1206]") : active ? "text-[#1c1206]" : "text-cream";

  const inner = (
    <>
      <svg
        viewBox="0 0 100 100"
        className={cn("absolute inset-0 w-full h-full -rotate-90", listening && "motion-safe:animate-pulse")}
        aria-hidden
      >
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(243,234,216,0.14)" strokeWidth="0.6" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="#efc27a"
          strokeWidth={live ? 1.6 : primary ? 1.3 : 0.9}
          strokeLinecap="round"
          strokeDasharray={c}
          className={cn(
            active && typeof progress === "number"
              ? "transition-[stroke-dashoffset] duration-300 ease-linear"
              : "transition-[stroke-dashoffset] duration-[1100ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
            arcOffset === null &&
              "[stroke-dashoffset:var(--off)] group-hover:[stroke-dashoffset:0] group-focus-visible:[stroke-dashoffset:0]",
          )}
          style={arcOffset === null ? { ["--off" as string]: `${c * 0.78}` } : { strokeDashoffset: arcOffset }}
        />
      </svg>
      <span
        className={cn(
          "absolute rounded-full border backdrop-blur-sm transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
          discClass,
          primary && !live && !disabled && "ring-breathe-soft group-hover:scale-[1.04] group-hover:bg-amber-300",
          !primary && !disabled && !active && "group-hover:bg-amber-400 group-hover:border-amber-300 group-hover:scale-[1.04]",
        )}
        style={{ inset: size * 0.13 }}
        aria-hidden
      />
      <span
        className={cn(
          "relative z-10 max-w-[70%] text-center font-bold uppercase leading-tight tracking-[0.18em] transition-colors duration-300",
          labelClass,
          !primary && !disabled && !active && "group-hover:text-[#1c1206]",
        )}
        style={{ fontSize: labelPx }}
      >
        {primary && active && (
          <span className="mx-auto mb-1.5 block h-2.5 w-2.5 rounded-full bg-[#e2574c] motion-safe:animate-pulse" aria-hidden />
        )}
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
      ref={buttonRef}
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
