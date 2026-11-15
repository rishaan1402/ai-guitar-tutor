"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { App } from "@capacitor/app";
import { StatusBar, Style } from "@capacitor/status-bar";
import { INTENDED_PATH_KEY, isNativeApp } from "@/lib/native";
import { getAccessToken } from "@/lib/auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/**
 * Inline script for <head>: in the app, every full page load is served the home page's HTML
 * (Capacitor serves index.html for any path). Remember the path that was asked for and point the
 * URL at "/" before React starts, so the page and the URL agree; NativeShell then routes there.
 */
export const NATIVE_BOOT_SCRIPT = `(function(){try{var C=window.Capacitor;if(C&&C.isNativePlatform&&C.isNativePlatform()&&location.pathname!=="/"&&!/\\.[a-z0-9]+$/i.test(location.pathname)){sessionStorage.setItem(${JSON.stringify(
  INTENDED_PATH_KEY,
)},location.pathname+location.search+location.hash);history.replaceState(null,"","/");}}catch(e){}})();`;

interface AppConfig {
  min_android_build: number;
  latest_android_build: number;
  android_store_url: string;
  message: string | null;
}

/** Android-only behaviour: back button, deep links, status bar, forced updates. Renders nothing on the web. */
export default function NativeShell() {
  const router = useRouter();
  const pathname = usePathname();
  const [update, setUpdate] = useState<AppConfig | null>(null);

  useEffect(() => {
    if (!isNativeApp()) return;
    document.documentElement.dataset.native = "android";

    // A full load landed on the home page: go where it was meant to go,
    // or straight to the room for a signed-in player opening the app.
    let intended: string | null = null;
    try {
      intended = sessionStorage.getItem(INTENDED_PATH_KEY);
      sessionStorage.removeItem(INTENDED_PATH_KEY);
    } catch {
      /* storage blocked */
    }
    if (intended) router.replace(intended);
    else if (window.location.pathname === "/" && getAccessToken()) router.replace("/dashboard");

    StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
    StatusBar.setBackgroundColor({ color: "#0c0a09" }).catch(() => {});

    const subs = [
      // Hardware back: go back a page, or leave the app from the first one
      App.addListener("backButton", ({ canGoBack }) => {
        if (canGoBack) window.history.back();
        else App.exitApp().catch(() => {});
      }),
      // Links that open the app (password reset, shared songs): route inside it
      App.addListener("appUrlOpen", ({ url }) => {
        try {
          const u = new URL(url);
          router.push(u.pathname + u.search + u.hash);
        } catch {
          /* not a URL we understand */
        }
      }),
    ];

    // Force an update when this build is too old to talk to the server safely
    (async () => {
      try {
        const [info, res] = await Promise.all([App.getInfo(), fetch(`${API_BASE}/api/app/config`)]);
        if (!res.ok) return;
        const cfg: AppConfig = await res.json();
        if (Number(info.build) < cfg.min_android_build) setUpdate(cfg);
      } catch {
        /* offline: never block on this */
      }
    })();

    return () => {
      subs.forEach((p) => p.then((s) => s.remove()).catch(() => {}));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // keep the WebView scrolled to the top on page changes, like a native screen
  useEffect(() => {
    if (isNativeApp()) window.scrollTo(0, 0);
  }, [pathname]);

  if (!update) return null;
  return (
    <div role="alertdialog" aria-modal="true" aria-labelledby="update-title" className="fixed inset-0 z-[100] flex items-center justify-center bg-ink-950/95 p-6">
      <div className="max-w-sm space-y-4 text-center">
        <h2 id="update-title" className="font-display text-2xl uppercase text-cream">Update needed</h2>
        <p className="text-cream/70">{update.message ?? "This version of Open Strings is out of date. Update to keep practising."}</p>
        <a href={update.android_store_url} className="inline-flex rounded-full bg-amber-400 px-6 py-3 font-semibold text-ink-950">
          Update on Google Play
        </a>
      </div>
    </div>
  );
}
