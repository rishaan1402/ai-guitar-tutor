import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Android and iOS app shell. The web app is built as static files (`npm run build:mobile`,
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
    backgroundColor: "#0b0a1a",
  },
  ios: {
    // the app's origin is capacitor://localhost (the API must allow it in ALLOWED_ORIGINS);
    // draw edge to edge; the web app pads itself with the safe-area insets
    contentInset: "never",
    backgroundColor: "#0b0a1a",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 900,
      launchAutoHide: true,
      backgroundColor: "#0b0a1a",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#0b0a1a",
      overlaysWebView: true,
    },
    // full screen: MainActivity hides the bars; the page is viewport-fit=cover, so insets go to CSS
    SystemBars: {
      initialViewportFitValueHint: "cover",
    },
  },
};

export default config;
