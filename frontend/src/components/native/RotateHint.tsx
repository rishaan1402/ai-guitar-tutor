"use client";

/**
 * The app is made for landscape. The Android app is locked sideways; in a
 * phone browser held upright, app screens ask you to turn the phone.
 * Marketing pages (home, download, legal) still read fine upright.
 */
import { usePathname } from "next/navigation";

const UPRIGHT_OK = ["/", "/download", "/privacy", "/terms", "/delete-account"];

export default function RotateHint() {
  const path = usePathname() ?? "/";
  if (UPRIGHT_OK.includes(path.replace(/\/$/, "") || "/")) return null;
  return (
    <div className="os-rotate fixed inset-0 z-[100] hidden flex-col items-center justify-center gap-5 bg-ink-950 p-8 text-center" role="dialog" aria-label="Turn your phone sideways">
      <svg width="88" height="88" viewBox="0 0 88 88" aria-hidden="true" className="os-rotate-phone">
        <rect x="26" y="10" width="36" height="68" rx="7" fill="none" stroke="#e8a54b" strokeWidth="4" />
        <circle cx="44" cy="70" r="3" fill="#e8a54b" />
      </svg>
      <p className="font-display text-2xl uppercase text-cream">Turn your phone sideways</p>
      <p className="max-w-xs text-cream/60">Open Strings is played in landscape, like holding a guitar.</p>
    </div>
  );
}
