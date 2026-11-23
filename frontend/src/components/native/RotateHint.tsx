"use client";

/**
 * Open Strings is played in landscape, like holding a guitar.
 *
 * - The Android app and the installed web app are locked sideways, so an
 *   upright phone there gets the turn-sideways screen on every app page.
 * - On the plain website, pages work upright. Only the screens that are
 *   actually played (the play-along highway, the stage) suggest turning the
 *   phone, and you can carry on upright anyway.
 */
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { isNativeApp } from "@/lib/native";
import { isStandalone } from "@/lib/pwa";

const UPRIGHT_OK = ["/", "/download", "/privacy", "/terms", "/delete-account"];
/** Screens played sideways: on the website they suggest turning the phone. */
const PLAYED_SIDEWAYS = ["/groove", "/path/session"];
const DISMISS_KEY = "os:upright-ok";

export default function RotateHint() {
  const path = (usePathname() ?? "/").replace(/\/$/, "") || "/";
  // "app" until we know: matches the server render, so nothing flashes on the website
  const [mode, setMode] = useState<"app" | "web" | null>(null);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    setMode(isNativeApp() || isStandalone() ? "app" : "web");
    try {
      setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      /* storage blocked */
    }
  }, []);

  if (mode === null || UPRIGHT_OK.includes(path)) return null;
  if (mode === "web" && (!PLAYED_SIDEWAYS.some((p) => path.startsWith(p)) || dismissed)) return null;

  const carryOn = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* storage blocked: it just asks again next page */
    }
  };

  return (
    <div className="os-rotate fixed inset-0 z-[100] hidden flex-col items-center justify-center gap-5 bg-ink-950 p-8 text-center" role="dialog" aria-label="Turn your phone sideways">
      <svg width="88" height="88" viewBox="0 0 88 88" aria-hidden="true" className="os-rotate-phone">
        <rect x="26" y="10" width="36" height="68" rx="7" fill="none" stroke="rgb(var(--acc-400))" strokeWidth="4" />
        <circle cx="44" cy="70" r="3" fill="rgb(var(--acc-400))" />
      </svg>
      <p className="font-display text-2xl uppercase text-cream">Turn your phone sideways</p>
      <p className="max-w-xs text-cream/70">
        {mode === "app" ? "Open Strings is played in landscape, like holding a guitar." : "This one is played in landscape, like holding a guitar: the strings run across the screen."}
      </p>
      {mode === "web" && (
        <button type="button" onClick={carryOn} className="rounded-full border border-cream/25 px-5 py-2 text-sm text-cream/85 hover:bg-cream/5">
          Continue upright
        </button>
      )}
    </div>
  );
}
