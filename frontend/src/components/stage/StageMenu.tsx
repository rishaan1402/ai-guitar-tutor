"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import Wordmark from "./Wordmark";

export interface MenuChapter {
  href: string;
  label: string;
  note: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  chapters: MenuChapter[];
  activeHref: string | null;
  signedIn: boolean;
  userName?: string;
  onLogout: () => void;
}

/** Full-screen menu: numbered chapters on the left, account actions on the right. */
export default function StageMenu({ open, onClose, chapters, activeHref, signedIn, userName, onLogout }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const returnFocus = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      // Keep Tab inside the menu
      if (e.key === "Tab" && panelRef.current) {
        const items = panelRef.current.querySelectorAll<HTMLElement>("a[href], button");
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      returnFocus?.focus();
    };
  }, [open, onClose]);

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label="Menu"
      aria-hidden={!open}
      className={`fixed inset-0 z-[60] overflow-y-auto transition-[opacity,visibility] duration-500 ${
        open ? "visible opacity-100" : "invisible opacity-0"
      }`}
      style={{
        background:
          "radial-gradient(ellipse 80% 60% at 20% 10%, rgba(92,104,64,0.55), transparent 70%), linear-gradient(180deg, #1c2318 0%, #0b0f0c 70%)",
      }}
    >
      <div className="mx-auto flex min-h-full max-w-7xl flex-col px-6 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <Link href="/" onClick={onClose} tabIndex={open ? 0 : -1}>
            <Wordmark />
          </Link>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            tabIndex={open ? 0 : -1}
            aria-label="Close menu"
            className="flex h-12 w-12 items-center justify-center rounded-full border border-cream/40 text-cream transition hover:bg-cream hover:text-moss-900"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" stroke="currentColor" strokeWidth="1.5" aria-hidden>
              <path d="M1 1l12 12M13 1L1 13" />
            </svg>
          </button>
        </div>

        <div className="grid flex-1 grid-cols-1 items-center gap-12 py-12 lg:grid-cols-[1.4fr_1fr]">
          <nav aria-label="Chapters">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cream/50 mb-6">Explore</p>
            <ol className="space-y-5">
              {chapters.map((c, i) => {
                const active = activeHref === c.href;
                return (
                  <li
                    key={c.href}
                    className="transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
                    style={{
                      transitionDelay: open ? `${120 + i * 70}ms` : "0ms",
                      transform: open ? "none" : "translateY(24px)",
                      opacity: open ? 1 : 0,
                    }}
                  >
                    <Link href={c.href} onClick={onClose} tabIndex={open ? 0 : -1} className="group block">
                      <span className="block text-[10px] font-semibold uppercase tracking-[0.24em] text-cream/35">
                        Chapter {String(i + 1).padStart(2, "0")} · {c.note}
                      </span>
                      <span
                        className={`font-display block text-[clamp(2.25rem,6vw,4.25rem)] font-bold uppercase leading-[0.95] transition-colors ${
                          active ? "text-amber-300" : "text-cream group-hover:text-amber-200"
                        }`}
                      >
                        {c.label}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </nav>

          <div
            className="flex flex-col gap-3 transition-all duration-700 lg:max-w-xs"
            style={{ transitionDelay: open ? "350ms" : "0ms", opacity: open ? 1 : 0 }}
          >
            {signedIn ? (
              <>
                {userName && <p className="mb-2 text-sm text-cream/60">Signed in as <span className="text-cream">{userName}</span></p>}
                <Link href="/profile" onClick={onClose} tabIndex={open ? 0 : -1} className="btn-outline w-full py-3.5">
                  Profile &amp; settings
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onLogout();
                  }}
                  tabIndex={open ? 0 : -1}
                  className="btn-outline w-full py-3.5"
                >
                  Log out
                </button>
              </>
            ) : (
              <>
                <Link href="/signup" onClick={onClose} tabIndex={open ? 0 : -1} className="btn-gradient w-full py-3.5">
                  Create free account
                </Link>
                <Link href="/login" onClick={onClose} tabIndex={open ? 0 : -1} className="btn-outline w-full py-3.5">
                  Log in
                </Link>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-cream/10 pt-5 text-[10px] font-semibold uppercase tracking-[0.2em] text-cream/40">
          <Link href="/" onClick={onClose} tabIndex={open ? 0 : -1} className="hover:text-cream/80">Home</Link>
          <Link href="/songs" onClick={onClose} tabIndex={open ? 0 : -1} className="hover:text-cream/80">Song library</Link>
          <span className="ml-auto normal-case tracking-normal text-cream/30">Press Esc to close</span>
        </div>
      </div>
    </div>
  );
}
