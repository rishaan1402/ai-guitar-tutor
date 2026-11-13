/**
 * Open Strings logo: a sound hole crossed by six strings, the 3rd string
 * (G, the open string beginners hear first) lit like it's ringing.
 */
interface MarkProps {
  size?: number;
  className?: string;
  /** Animate the lit string (respects prefers-reduced-motion via CSS). */
  ringing?: boolean;
}

export function LogoMark({ size = 28, className, ringing = false }: MarkProps) {
  const xs = [7, 10.2, 13.4, 16.6, 19.8, 23];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 30 30"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="15" cy="15" r="11.5" fill="none" stroke="currentColor" strokeOpacity="0.9" strokeWidth="2" />
      <circle cx="15" cy="15" r="8" fill="currentColor" fillOpacity="0.08" />
      {xs.map((x, i) => (
        <line
          key={x}
          x1={x}
          x2={x}
          y1="1.5"
          y2="28.5"
          stroke={i === 2 ? "var(--logo-lit, #e8a54b)" : "currentColor"}
          strokeOpacity={i === 2 ? 1 : 0.55}
          strokeWidth={i < 3 ? 1.3 - i * 0.15 : 0.9}
          strokeLinecap="round"
          className={i === 2 && ringing ? "os-string-ring" : undefined}
        />
      ))}
    </svg>
  );
}

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  ringing?: boolean;
}

/** Mark + wordmark. The wordmark is real text so it stays crisp and accessible. */
export default function Logo({ className = "", size = "md", ringing = false }: LogoProps) {
  const mark = size === "lg" ? 40 : size === "sm" ? 22 : 28;
  const text = size === "lg" ? "text-2xl" : size === "sm" ? "text-sm" : "text-base";
  return (
    <span className={`inline-flex items-center gap-2 text-cream ${className}`}>
      <LogoMark size={mark} ringing={ringing} />
      <span className={`font-display uppercase tracking-tight leading-none ${text}`}>
        Open<span className="text-amber-400"> </span>Strings
      </span>
    </span>
  );
}
