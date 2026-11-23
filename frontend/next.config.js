/** @type {import('next').NextConfig} */

// MOBILE_BUILD=1 builds plain static files for the Android app (Capacitor serves them from the APK).
// The website on Vercel keeps the normal build, plus a redirect for the old chord-history URLs
// and the security headers below (a static export can't send headers, so the app doesn't get them).
const mobile = process.env.MOBILE_BUILD === "1";
const dev = process.env.NODE_ENV === "development";

const apiOrigin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").origin;
  } catch {
    return "";
  }
})();

// Sentry's ingest host, when error monitoring is on (NEXT_PUBLIC_SENTRY_DSN)
const sentryOrigin = (() => {
  try {
    return process.env.NEXT_PUBLIC_SENTRY_DSN ? new URL(process.env.NEXT_PUBLIC_SENTRY_DSN).origin : "";
  } catch {
    return "";
  }
})();

// Who the site may talk to. Inline scripts stay allowed: Next.js inlines its own
// bootstrap scripts, and nonces would force every page to render on the server.
// What this blocks is script, frames and connections from anywhere not listed.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""} https://accounts.google.com https://connect.facebook.net`,
  "style-src 'self' 'unsafe-inline' https://accounts.google.com",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' ${apiOrigin} https://accounts.google.com https://*.facebook.com https://storage.googleapis.com ${sentryOrigin}`.trim(),
  `media-src 'self' blob: data: ${apiOrigin} https://storage.googleapis.com`,
  "worker-src 'self' blob:",
  "frame-src https://accounts.google.com https://*.facebook.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(apiOrigin.startsWith("https:") ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // the microphone is the whole product; nothing else is needed
  { key: "Permissions-Policy", value: "microphone=(self), camera=(), geolocation=(), payment=(), usb=()" },
];

const nextConfig = mobile
  ? {
      output: "export",
      distDir: "out-build",
      images: { unoptimized: true },
    }
  : {
      poweredByHeader: false,
      async headers() {
        return [{ source: "/:path*", headers: securityHeaders }];
      },
      async redirects() {
        return [{ source: "/progress/chord/:name", destination: "/progress/chord?name=:name", permanent: true }];
      },
    };

module.exports = nextConfig;
