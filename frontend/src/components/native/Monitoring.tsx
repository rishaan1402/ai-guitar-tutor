"use client";

/**
 * Error monitoring and page-view analytics, both off unless configured.
 *
 * - Sentry: only when NEXT_PUBLIC_SENTRY_DSN is set at build time, loaded after
 *   the page is up (no cost to first load). No personal data, no session
 *   replay, no request bodies.
 * - Vercel Web Analytics: page views only, no cookies. Loaded on the
 *   production website (NEXT_PUBLIC_VERCEL_ENV=production), never in the app.
 */
import Script from "next/script";
import { useEffect } from "react";
import { isNativeApp } from "@/lib/native";

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;
const ON_VERCEL_PRODUCTION = process.env.NEXT_PUBLIC_VERCEL_ENV === "production";

export default function Monitoring() {
  useEffect(() => {
    if (!SENTRY_DSN) return;
    let cancelled = false;
    import("@sentry/browser").then((Sentry) => {
      if (cancelled) return;
      Sentry.init({
        dsn: SENTRY_DSN,
        environment: isNativeApp() ? "app" : ON_VERCEL_PRODUCTION ? "production" : "preview",
        tracesSampleRate: 0,
        // a stale tab or a browser extension is not our bug
        ignoreErrors: ["ResizeObserver loop", "Non-Error promise rejection captured", "AbortError"],
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ON_VERCEL_PRODUCTION) return null;
  return <Script src="/_vercel/insights/script.js" strategy="afterInteractive" />;
}
