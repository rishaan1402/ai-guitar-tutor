import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  /** Small mono label above the title ("The record wall"). */
  kicker?: string;
  action?: React.ReactNode;
  className?: string;
  /** Use "h1" for the page's main heading (one per page). */
  as?: "h1" | "h2";
}

/**
 * Page titles are big display caps; section titles are compact display
 * headings with an optional mono kicker, so a page reads as one voice.
 */
export function SectionHeader({ title, subtitle, kicker, action, className, as: Tag = "h2" }: SectionHeaderProps) {
  const page = Tag === "h1";
  return (
    <div className={cn("mb-6 flex items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        {kicker && <p className={cn("label-mono", page ? "text-amber-300" : "text-cream/45")}>{kicker}</p>}
        <Tag
          className={cn(
            "font-display uppercase text-cream",
            page ? "text-h1" : "text-xl tracking-tight sm:text-2xl",
            kicker && "mt-1.5",
          )}
        >
          {title}
        </Tag>
        {subtitle && <p className={cn("text-cream/60", page ? "mt-3 max-w-xl" : "mt-1 text-sm")}>{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
