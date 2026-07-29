import { cn } from "@/lib/utils";

/** Logo: a sound hole crossed by six strings, plus the name in display caps. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("h-7 w-7", className)} aria-hidden>
      <circle cx="16" cy="16" r="10" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="16" cy="16" r="13.5" fill="none" stroke="currentColor" strokeWidth="0.8" opacity="0.45" />
      {[11, 13, 15, 17, 19, 21].map((x, i) => (
        <line key={x} x1={x} y1="3" x2={x} y2="29" stroke="currentColor" strokeWidth={1.1 - i * 0.1} opacity={0.9} />
      ))}
      <circle cx="16" cy="16" r="2.2" fill="#e8a54b" />
    </svg>
  );
}

export default function Wordmark({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 text-cream", className)}>
      <LogoMark />
      {!compact && (
        <span className="font-display text-[15px] font-bold uppercase leading-none tracking-[0.08em]">
          <span className="text-amber-400">AI</span> Guitar Tutor
        </span>
      )}
    </span>
  );
}
