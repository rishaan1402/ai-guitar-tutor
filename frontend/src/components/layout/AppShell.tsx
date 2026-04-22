"use client";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import NavBar from "@/components/NavBar";

interface AppShellProps {
  children: React.ReactNode;
}

/**
 * Wraps every authenticated page:
 *  - NavBar at top
 *  - TooltipProvider for shadcn tooltips
 *  - Toaster (sonner) for toast notifications
 *  - Main content area with consistent padding
 */
export function AppShell({ children }: AppShellProps) {
  return (
    <TooltipProvider>
      <div className="min-h-screen flex flex-col">
        <NavBar />
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </main>
      </div>
      <Toaster
        theme="dark"
        position="bottom-right"
        toastOptions={{
          style: {
            background: "rgba(15,11,26,0.95)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "#e5e7eb",
            backdropFilter: "blur(16px)",
          },
        }}
      />
    </TooltipProvider>
  );
}
