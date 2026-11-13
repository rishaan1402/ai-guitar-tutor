import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
  /** Use "h1" for the page's main heading (one per page). */
  as?: "h1" | "h2";
}

export function SectionHeader({ title, subtitle, action, className, as: Tag = "h2" }: SectionHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-4 mb-6", className)}>
      <div>
        <Tag className={cn("gradient-text", Tag === "h1" ? "text-h1" : "text-h2")}>{title}</Tag>
        {subtitle && <p className="text-gray-400 mt-1 text-sm">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
