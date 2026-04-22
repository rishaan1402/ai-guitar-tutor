"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const ROLE_BADGE: Record<string, string> = {
  admin:   "bg-red-500/20 text-red-300 border-red-500/30",
  teacher: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  student: "bg-green-500/20 text-green-300 border-green-500/30",
};

interface NavItem {
  href: string;
  label: string;
  authRequired?: boolean;
  teacherOnly?: boolean;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", authRequired: true },
  { href: "/",          label: "Practice" },
  { href: "/?mode=song",label: "Songs" },
  { href: "/?mode=transitions", label: "Transitions" },
  { href: "/progress",  label: "Progress", authRequired: true },
  { href: "/teacher",   label: "Class",    authRequired: true, teacherOnly: true },
  { href: "/admin",     label: "Admin",    authRequired: true, adminOnly: true },
];

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        "text-sm font-medium transition-colors px-3 py-1.5 rounded-md",
        active
          ? "text-white bg-white/10"
          : "text-gray-400 hover:text-white hover:bg-white/5"
      )}
    >
      {label}
    </Link>
  );
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

  const visibleItems = NAV_ITEMS.filter(item => {
    if (item.adminOnly && !isAdmin) return false;
    if (item.teacherOnly && !isTeacher && !isAdmin) return false;
    if (item.authRequired && !user) return false;
    return true;
  });

  return (
    <nav className="sticky top-0 z-50 w-full glass border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-4">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <span className="text-xl">🎸</span>
          <span className="font-bold text-white hidden sm:inline">AI Guitar Tutor</span>
        </Link>

        {/* Desktop nav links */}
        <div className="hidden md:flex items-center gap-1">
          {visibleItems.map(item => (
            <NavLink
              key={item.href}
              href={item.href}
              label={item.label}
              active={item.href === "/" ? pathname === "/" : pathname.startsWith(item.href.split("?")[0])}
            />
          ))}
        </div>

        {/* Right side: user or auth buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {loading ? (
            <div className="w-20 h-7 skeleton rounded" />
          ) : user ? (
            <>
              {/* Desktop user info */}
              <div className="hidden md:flex items-center gap-2">
                <Link
                  href="/profile"
                  className="text-sm text-gray-300 hover:text-white transition-colors"
                >
                  {user.display_name}
                </Link>
                <span className={cn(
                  "text-xs px-2 py-0.5 rounded-full font-medium border",
                  ROLE_BADGE[user.role] ?? "bg-gray-500/20 text-gray-300 border-gray-500/30"
                )}>
                  {user.role}
                </span>
                <button
                  onClick={handleLogout}
                  className="text-xs text-gray-500 hover:text-gray-300 transition-colors ml-1"
                >
                  Logout
                </button>
              </div>

              {/* Mobile hamburger */}
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger
                  className="md:hidden p-2 text-gray-400 hover:text-white"
                  aria-label="Open menu"
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M3 5h14M3 10h14M3 15h14" strokeLinecap="round"/>
                  </svg>
                </SheetTrigger>
                <SheetContent side="right" className="w-64 bg-[#0f0b1a] border-white/10 p-0">
                  <div className="flex flex-col h-full">
                    {/* Mobile user header */}
                    <div className="p-5 border-b border-white/10">
                      <div className="font-semibold text-white">{user.display_name}</div>
                      <div className={cn(
                        "text-xs mt-1 inline-block px-2 py-0.5 rounded-full font-medium border",
                        ROLE_BADGE[user.role]
                      )}>
                        {user.role}
                      </div>
                    </div>

                    {/* Mobile nav links */}
                    <nav className="flex-1 p-4 space-y-1">
                      {visibleItems.map(item => (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setMobileOpen(false)}
                          className="block px-3 py-2 rounded-md text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
                        >
                          {item.label}
                        </Link>
                      ))}
                    </nav>

                    {/* Mobile footer */}
                    <div className="p-4 border-t border-white/10 space-y-2">
                      <Link
                        href="/profile"
                        onClick={() => setMobileOpen(false)}
                        className="block px-3 py-2 rounded-md text-sm text-gray-300 hover:text-white hover:bg-white/5"
                      >
                        Profile
                      </Link>
                      <button
                        onClick={handleLogout}
                        className="w-full text-left px-3 py-2 rounded-md text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                      >
                        Logout
                      </button>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-sm text-gray-300 hover:text-white transition-colors"
              >
                Log In
              </Link>
              <Link
                href="/signup"
                className="text-sm btn-gradient px-4 py-1.5"
              >
                Sign Up
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
