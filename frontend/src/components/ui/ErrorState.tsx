"use client";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
  title?: string;
  message?: string;
  retry?: () => void;
  className?: string;
}

export function ErrorState({
  title = "Something went wrong",
  message = "An unexpected error occurred. Please try again.",
  retry,
  className,
}: ErrorStateProps) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center text-center py-12 px-6 glass-card border border-red-500/20",
      className
    )}>
      <div className="text-3xl mb-3">⚠️</div>
      <h3 className="text-lg font-semibold text-red-400 mb-2">{title}</h3>
      <p className="text-gray-500 text-sm max-w-sm">{message}</p>
      {retry && (
        <button
          onClick={retry}
          className="mt-6 btn-gradient text-sm px-4 py-2"
        >
          Try Again
        </button>
      )}
    </div>
  );
}
