import { cn } from "@/lib/utils";

interface LoadingSkeletonProps {
  className?: string;
  lines?: number;
}

export function LoadingSkeleton({ className, lines = 3 }: LoadingSkeletonProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={cn("skeleton h-4 rounded", i === lines - 1 && "w-3/4")}
        />
      ))}
    </div>
  );
}

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("glass-card space-y-3 animate-pulse", className)}>
      <div className="skeleton h-5 w-1/3 rounded" />
      <div className="skeleton h-3 w-full rounded" />
      <div className="skeleton h-3 w-4/5 rounded" />
      <div className="skeleton h-8 w-1/4 rounded mt-4" />
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="glass-card space-y-2 animate-pulse">
      <div className="skeleton h-3 w-1/2 rounded" />
      <div className="skeleton h-7 w-2/3 rounded" />
      <div className="skeleton h-2 w-1/3 rounded" />
    </div>
  );
}
