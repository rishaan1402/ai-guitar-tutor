"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

export function MarketingNav() {
  const { user, loading } = useAuth();

  return (
    <nav className="sticky top-0 z-50 w-full glass border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <span className="text-xl">🎸</span>
          <span className="font-bold text-white tracking-tight">AI Guitar Tutor</span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          <a href="#features" className="text-sm text-gray-400 hover:text-white transition-colors">
            Features
          </a>
          <a href="#how-it-works" className="text-sm text-gray-400 hover:text-white transition-colors">
            How it works
          </a>
          <a href="#for-teachers" className="text-sm text-gray-400 hover:text-white transition-colors">
            For teachers
          </a>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {loading ? (
            <div className="w-24 h-8 skeleton rounded" />
          ) : user ? (
            <Link href="/dashboard" className="btn-gradient text-sm px-4 py-2">
              Go to Dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="hidden sm:inline text-sm text-gray-300 hover:text-white transition-colors"
              >
                Log In
              </Link>
              <Link href="/signup" className="btn-gradient text-sm px-4 py-2">
                Start Free
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
