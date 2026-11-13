/** Browser-specific steps to re-allow a blocked microphone (by user-agent sniffing). */

export type MicBrowser = "chrome" | "safari_ios" | "safari" | "firefox" | "edge" | "other";

export function micBrowser(ua: string): MicBrowser {
  const u = ua || "";
  if (/Edg\//.test(u)) return "edge";
  if (/Firefox\/|FxiOS\//.test(u)) return "firefox";
  if (/iPhone|iPad|iPod/.test(u)) return "safari_ios"; // every iOS browser is WebKit
  if (/Chrome\/|CriOS\/|Chromium\//.test(u)) return "chrome";
  if (/Safari\//.test(u)) return "safari";
  return "other";
}

export function micHelp(ua: string): { browser: MicBrowser; steps: string[] } {
  const browser = micBrowser(ua);
  const steps: Record<MicBrowser, string[]> = {
    chrome: [
      "Click the icon left of the address bar (the tune / lock icon).",
      "Open Site settings, set Microphone to Allow.",
      "Come back here and press Try again.",
    ],
    edge: [
      "Click the lock icon left of the address bar.",
      "Set Microphone to Allow for this site.",
      "Come back here and press Try again.",
    ],
    safari_ios: [
      "Tap the aA button in the address bar.",
      "Choose Website Settings, set Microphone to Allow.",
      "Come back here and tap Try again.",
    ],
    safari: [
      "Open Safari → Settings for This Website (in the Safari menu).",
      "Set Microphone to Allow.",
      "Come back here and press Try again.",
    ],
    firefox: [
      "Click the crossed-out microphone icon in the address bar.",
      "Remove the Blocked permission for the microphone.",
      "Press Try again and choose Allow.",
    ],
    other: [
      "Open this site's settings in your browser (usually the icon left of the address).",
      "Allow the microphone.",
      "Come back here and press Try again.",
    ],
  };
  return { browser, steps: steps[browser] };
}
