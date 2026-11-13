"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import Logo from "@/components/brand/Logo";
import SoundToggle from "@/components/brand/SoundToggle";

const LINKS = [
  { href: "#room", label: "The room" },
  { href: "#listen", label: "Listening" },
  { href: "#songs", label: "Songs" },
  { href: "#teachers", label: "Teachers" },
];

export function MarketingNav() {
  const { user, loading } = useAuth();

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-cream/5 bg-ink-950/75 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="shrink-0" aria-label="Open Strings home">
          <Logo size="md" />
        </Link>

        <div className="hidden items-center gap-7 md:flex">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="label-mono text-cream/60 transition-colors hover:text-amber-300">
              {l.label}
            </a>
          ))}
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <SoundToggle />
          {loading ? (
            <div className="h-9 w-28 rounded-full skeleton" />
          ) : user ? (
            <Link href="/dashboard" className="rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-ink-950 transition hover:bg-amber-300">
              Enter your room
            </Link>
          ) : (
            <>
              <Link href="/login" className="hidden text-sm text-cream/70 hover:text-cream sm:inline">
                Log in
              </Link>
              <Link href="/start" className="rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-ink-950 transition hover:bg-amber-300">
                Start free
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
