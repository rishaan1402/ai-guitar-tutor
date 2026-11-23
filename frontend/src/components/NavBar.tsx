"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import Logo from "@/components/brand/Logo";
import SoundToggle from "@/components/brand/SoundToggle";
import ThemeToggle from "@/components/brand/ThemeToggle";
import InstallApp from "@/components/native/InstallApp";

interface NavItem {
  href: string;
  label: string;
  /** Marks this item active (default: the path of href). */
  active?: (pathname: string, search: string) => boolean;
  authRequired?: boolean;
  teacherOnly?: boolean;
  adminOnly?: boolean;
  /** Shown in the top bar on wide screens (everything is in the menu). */
  top?: boolean;
  group: "Learn" | "Songs" | "Play" | "You";
  /** One line under the label in the menu. */
  hint?: string;
}

const isSongMode = (search: string) => /(^|[?&])mode=song(&|$)/.test(search);

const NAV_ITEMS: NavItem[] = [
  { href: "/studio", label: "Studio", top: true, group: "Learn", hint: "Your practice room" },
  { href: "/path", label: "Lessons", top: true, group: "Learn", hint: "Four tracks, beginner to pro", active: (p) => p.startsWith("/path") },
  {
    href: "/practice", label: "Chords", top: true, group: "Learn", hint: "Any chord: watch it, play it, hear every string",
    active: (p, s) => (p === "/practice" && !isSongMode(s)) || p.startsWith("/chords"),
  },
  {
    href: "/practice?mode=song", label: "Songs", top: true, group: "Songs", hint: "Any song: chart, tabs, a lesson for each part",
    active: (p, s) => p === "/practice" && isSongMode(s),
  },
  { href: "/songs", label: "Chord sheets", group: "Songs", hint: "Your charts: transpose, capo, autoscroll", active: (p) => p.startsWith("/songs") },
  { href: "/groove", label: "Grooves", top: true, group: "Play", hint: "Play along with a band" },
  { href: "/rhythm", label: "Strum trainer", group: "Play", hint: "Any strum with a click: every hit early, late or on time" },
  { href: "/tuner", label: "Tuner", top: true, group: "Play", hint: "Tune any string, any tuning" },
  { href: "/coach", label: "Coach", top: true, group: "You", hint: "Ask, set a goal, your week" },
  { href: "/dashboard", label: "Today", authRequired: true, group: "You", hint: "Today's plan and streak" },
  { href: "/progress", label: "Progress", authRequired: true, group: "You", hint: "Chords, stars and history" },
  { href: "/teacher", label: "Class", authRequired: true, teacherOnly: true, group: "You" },
  { href: "/admin", label: "Admin", authRequired: true, adminOnly: true, group: "You" },
];
const GROUPS: NavItem["group"][] = ["Learn", "Songs", "Play", "You"];

function isActive(item: NavItem, pathname: string, search: string): boolean {
  return item.active ? item.active(pathname, search) : pathname === item.href.split("?")[0];
}

/** The query string, for items that differ only by it (Chords vs Songs on /practice). */
function WithSearch({ children }: { children: (search: string) => ReactNode }) {
  return (
    <Suspense fallback={children("")}>
      <SearchReader>{children}</SearchReader>
    </Suspense>
  );
}
function SearchReader({ children }: { children: (search: string) => ReactNode }) {
  return <>{children(useSearchParams()?.toString() ?? "")}</>;
}

export default function NavBar() {
  const { user, loading, logout, isTeacher, isAdmin } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = async () => {
    await logout();
    router.push("/");
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
        <Link href="/studio" className="shrink-0" aria-label="Open Strings: your studio">
          <Logo size="md" />
        </Link>

        <WithSearch>{(search) => (
        <div className="hidden min-w-0 items-center gap-0.5 lg:flex">
          {items.filter((i) => i.top).map((item) => {
            const active = isActive(item, pathname, search);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "label-mono whitespace-nowrap rounded-full px-2.5 py-2 transition-colors duration-fast",
                  active ? "bg-amber-400/10 text-amber-300" : "text-cream/60 hover:text-cream",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
        )}</WithSearch>

        <div className="flex shrink-0 items-center gap-2">
          <ThemeToggle />
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
            <button onClick={handleLogout} className="label-mono hidden text-cream/60 hover:text-cream lg:inline">
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

          <AppMenu />
        </div>
      </div>
    </nav>
  );
}

/** The app menu (all features, grouped). Used by the top bar and by full-screen screens that have no top bar. */
export function AppMenu({ className = "" }: { className?: string }) {
  const { user, logout, isTeacher, isAdmin } = useAuth();
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
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger className={cn("rounded-full p-2 text-cream/70 hover:text-cream", className)} aria-label="Open menu">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <path d="M3 6h14M3 10h14M3 14h14" strokeLinecap="round" />
              </svg>
            </SheetTrigger>
            <SheetContent side="right" className="w-80 overflow-y-auto border-cream/10 bg-ink-950 p-0">
              <div className="flex h-full flex-col">
                <div className="border-b border-cream/10 p-5">
                  <Logo size="sm" />
                  {user && <p className="mt-3 text-sm text-cream/70">Signed in as {user.display_name}</p>}
                </div>
                <WithSearch>{(search) => (
                <div className="flex-1 space-y-3 p-3">
                  {GROUPS.map((g) => {
                    const list = items.filter((i) => i.group === g);
                    if (!list.length) return null;
                    return (
                      <div key={g}>
                        <p className="label-mono px-4 pb-1 pt-1 text-[10px] text-cream/60">{g}</p>
                        {list.map((item) => (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setMobileOpen(false)}
                            aria-current={isActive(item, pathname, search) ? "page" : undefined}
                            className={cn(
                              "block rounded-xl px-4 py-2",
                              isActive(item, pathname, search) ? "bg-amber-400/10 text-amber-300" : "text-cream hover:bg-cream/5",
                            )}
                          >
                            <span className="block font-display text-base uppercase">{item.label}</span>
                            {item.hint && <span className="block text-xs text-cream/65">{item.hint}</span>}
                          </Link>
                        ))}
                      </div>
                    );
                  })}
                  <InstallApp variant="menu" />
                </div>
                )}</WithSearch>
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
  );
}
