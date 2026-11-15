/** @type {import('next').NextConfig} */

// MOBILE_BUILD=1 builds plain static files for the Android app (Capacitor serves them from the APK).
// The website on Vercel keeps the normal build, plus a redirect for the old chord-history URLs.
const mobile = process.env.MOBILE_BUILD === "1";

const nextConfig = mobile
  ? {
      output: "export",
      distDir: "out-build",
      images: { unoptimized: true },
    }
  : {
      async redirects() {
        return [{ source: "/progress/chord/:name", destination: "/progress/chord?name=:name", permanent: true }];
      },
    };

module.exports = nextConfig;
