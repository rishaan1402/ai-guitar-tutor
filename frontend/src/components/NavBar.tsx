"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import Logo from "@/components/brand/Logo";
import SoundToggle from "@/components/brand/SoundToggle";

interface NavItem {
  href: string;
  label: string;
  /** Path that marks this item active (defaults to href without the query). */
  match?: string;
  authRequired?: boolean;
  teacherOnly?: boolean;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Room", authRequired: true },
  { href: "/practice", label: "Practice" },
  { href: "/practice?mode=song", label: "Learn a song", match: "#song" },
  { href: "/songs", label: "Songs" },
  { href: "/tuner", label: "Tuner" },
  { href: "/progress", label: "Progress", authRequired: true },
  { href: "/teacher", label: "Class", authRequired: true, teacherOnly: true },
  { href: "/admin", label: "Admin", authRequired: true, adminOnly: true },
];

function isActive(item: NavItem, pathname: string): boolean {
  if (item.match === "#song") return false; // query-based; Practice stays lit for /practice
  return pathname === (item.match ?? item.href.split("?")[0]);
}

export default function NavBar() {
  const { user, loading, logout, isTeacher, isAdmin } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    router.push("/");
    setMobileOpen(false);
  };

  const items = NAV_ITEMS.filter((item) => {
    if (item.adminOnly && !isAdmin) return false;
    if (item.teacherOnly && !isTeacher && !isAdmin) return false;
    if (item.authRequired && !user) return false;
    return true;
  });

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-cream/5 bg-ink-950/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href={user ? "/dashboard" : "/"} className="shrink-0" aria-label="Open Strings — your room">
          <Logo size="md" />
        </Link>

        <div className="hidden items-center gap-1 lg:flex">
          {items.map((item) => {
            const active = isActive(item, pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "label-mono rounded-full px-3 py-2 transition-colors duration-fast",
                  active ? "bg-amber-400/10 text-amber-300" : "text-cream/60 hover:text-cream",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <SoundToggle />
          {loading ? (
            <div className="h-8 w-20 rounded-full skeleton" />
          ) : user ? (
            <Link
              href="/profile"
              className="hidden h-9 items-center gap-2 rounded-full border border-cream/10 pl-1 pr-3 text-sm text-cream/80 hover:border-cream/25 lg:inline-flex"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-400 font-display text-xs text-ink-950">
                {user.display_name.slice(0, 1).toUpperCase()}
              </span>
              {user.display_name}
            </Link>
          ) : null}
          {!loading && user && (
            <button onClick={handleLogout} className="label-mono hidden text-cream/40 hover:text-cream lg:inline">
              Log out
            </button>
          )}
          {loading || user ? null : (
            <span className="hidden items-center gap-3 lg:inline-flex">
              <Link href="/login" className="text-sm text-cream/70 hover:text-cream">
                Log in
              </Link>
              <Link href="/signup" className="rounded-full bg-amber-400 px-4 py-1.5 text-sm font-semibold text-ink-950 hover:bg-amber-300">
                Sign up
              </Link>
            </span>
          )}

          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger className="rounded-full p-2 text-cream/70 hover:text-cream lg:hidden" aria-label="Open menu">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <path d="M3 6h14M3 10h14M3 14h14" strokeLinecap="round" />
              </svg>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 border-cream/10 bg-ink-950 p-0">
              <div className="flex h-full flex-col">
                <div className="border-b border-cream/10 p-5">
                  <Logo size="sm" />
                  {user && <p className="mt-3 text-sm text-cream/70">Signed in as {user.display_name}</p>}
                </div>
                <div className="flex-1 space-y-1 p-3">
                  {items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "block rounded-xl px-4 py-3 font-display text-lg uppercase",
                        isActive(item, pathname) ? "bg-amber-400/10 text-amber-300" : "text-cream hover:bg-cream/5",
                      )}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
                <div className="space-y-1 border-t border-cream/10 p-3">
                  {user ? (
                    <>
                      <Link href="/profile" onClick={() => setMobileOpen(false)} className="block rounded-xl px-4 py-3 text-sm text-cream/80 hover:bg-cream/5">
                        Profile
                      </Link>
                      <button onClick={handleLogout} className="w-full rounded-xl px-4 py-3 text-left text-sm text-amp-300 hover:bg-amp-500/10">
                        Log out
                      </button>
                    </>
                  ) : (
                    <>
                      <Link href="/login" onClick={() => setMobileOpen(false)} className="block rounded-xl px-4 py-3 text-sm text-cream/80 hover:bg-cream/5">
                        Log in
                      </Link>
                      <Link href="/signup" onClick={() => setMobileOpen(false)} className="block rounded-xl bg-amber-400 px-4 py-3 text-center text-sm font-semibold text-ink-950">
                        Sign up free
                      </Link>
                    </>
                  )}
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
}
