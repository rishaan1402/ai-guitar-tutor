import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Android app shell. The web app is built as static files (`npm run build:mobile`,
 * MOBILE_BUILD=1) into out-build/ and served from inside the APK; it talks to the
 * production API. appId is permanent once published on Google Play.
 */
const config: CapacitorConfig = {
  appId: "app.openstrings",
  appName: "Open Strings",
  webDir: "out-build",
  android: {
    // the app's origin is https://localhost (the API must allow it in ALLOWED_ORIGINS)
    allowMixedContent: false,
    backgroundColor: "#0c0a09",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 900,
      launchAutoHide: true,
      backgroundColor: "#0c0a09",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#0c0a09",
      overlaysWebView: false,
    },
  },
};

export default config;
