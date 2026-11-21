/**
 * Installing the website as an app (PWA): the browser's install prompt where there
 * is one (Android / desktop Chrome, Edge), Add to Home Screen steps on iPhone and
 * iPad, nothing when it's already installed or running as the Android/iOS app.
 */
import { isNativeApp } from "./native";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: InstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export type InstallMode = "prompt" | "ios" | "installed" | "none";

/** Opened from the home screen (or the app itself)? */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(display-mode: standalone)").matches || window.matchMedia?.("(display-mode: fullscreen)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
}

/** iPhone / iPad (iPadOS reports itself as a Mac with touch). */
export function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function installMode(): InstallMode {
  if (typeof window === "undefined" || isNativeApp()) return "none";
  if (installed || isStandalone()) return "installed";
  if (deferred) return "prompt";
  if (isIos()) return "ios";
  return "none";
}

export function subscribeInstall(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Show the browser's install prompt. Resolves true when the user installs. */
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  const e = deferred;
  deferred = null;
  await e.prompt();
  const { outcome } = await e.userChoice;
  if (outcome === "accepted") installed = true;
  emit();
  return outcome === "accepted";
}

/** Called once on start-up: register the service worker and catch the install prompt. */
export function startPwa(): void {
  if (typeof window === "undefined" || isNativeApp()) return;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // we show our own button
    deferred = e as InstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    installed = true;
    deferred = null;
    emit();
  });
  if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }
}
