"use client";

/**
 * "Install app": the browser's own install prompt where there is one, or the
 * Add to Home Screen steps on iPhone / iPad. Renders nothing once installed,
 * inside the Android / iOS apps, and in browsers that can't install.
 */
import { useState, useSyncExternalStore } from "react";
import { installMode, promptInstall, subscribeInstall, type InstallMode } from "@/lib/pwa";

export default function InstallApp({ variant = "button", className = "" }: { variant?: "button" | "menu" | "card"; className?: string }) {
  const mode = useSyncExternalStore<InstallMode>(subscribeInstall, installMode, () => "none");
  const [steps, setSteps] = useState(false);
  if (mode === "none") return null;

  if (mode === "installed") {
    return variant === "card" ? (
      <div className={`rounded-2xl border border-sage-300/30 bg-sage-300/10 p-4 text-sm text-sage-100 ${className}`}>Installed: open Open Strings from your home screen.</div>
    ) : null;
  }

  const onClick = () => (mode === "prompt" ? void promptInstall() : setSteps((v) => !v));
  const label = mode === "prompt" ? "Install the app" : "Add to Home Screen";

  return (
    <div className={className}>
      {variant === "menu" ? (
        <button type="button" onClick={onClick} className="block w-full rounded-xl px-4 py-2 text-left hover:bg-cream/5">
          <span className="block font-display text-base uppercase text-amber-300">{label}</span>
          <span className="block text-xs text-cream/50">Its own icon, full screen, no app store</span>
        </button>
      ) : variant === "card" ? (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-400/5 p-4">
          <p className="font-semibold text-cream">Install Open Strings from this website</p>
          <p className="mt-1 text-sm text-cream/65">
            It gets its own icon and opens full screen like an app. {mode === "ios" ? "Works on iPhone and iPad, no App Store needed." : ""}
          </p>
          <button type="button" onClick={onClick} className="mt-3 h-11 rounded-full bg-amber-400 px-5 font-semibold text-ink-950">
            {label}
          </button>
        </div>
      ) : (
        <button type="button" onClick={onClick} className="h-10 rounded-full border border-amber-400/50 px-4 text-sm font-semibold text-amber-100">
          {label}
        </button>
      )}
      {steps && mode === "ios" && <IosSteps onClose={() => setSteps(false)} />}
    </div>
  );
}

function IosSteps({ onClose }: { onClose: () => void }) {
  return (
    <div className="mt-3 rounded-2xl border border-cream/10 bg-ink-900 p-4 text-left text-sm text-cream/85" role="dialog" aria-label="Add to Home Screen">
      <ol className="list-decimal space-y-1.5 pl-5">
        <li>
          Open this page in <strong>Safari</strong> (on iOS 16.4 and newer, Chrome works too).
        </li>
        <li>
          Tap the <strong>Share</strong> button{" "}
          <svg className="inline h-4 w-4 align-[-2px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M12 3v12M7 8l5-5 5 5M5 12v8h14v-8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>{" "}
          (bottom of the screen on iPhone, top on iPad).
        </li>
        <li>
          Scroll and tap <strong>Add to Home Screen</strong>, then <strong>Add</strong>.
        </li>
        <li>Open Open Strings from your home screen and allow the microphone when asked.</li>
      </ol>
      <button type="button" onClick={onClose} className="mt-3 text-cream/55 underline-offset-4 hover:underline">
        Close
      </button>
    </div>
  );
}
