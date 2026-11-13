/** localStorage flags for the setup flow (all wrapped: storage may be blocked). */
export const ONBOARDED_KEY = "agt:onboarded";
export const GAIN_HINT_KEY = "agt:inputGainHint";

export function markOnboarded(peakDbfs?: number): void {
  try {
    localStorage.setItem(ONBOARDED_KEY, "1");
    if (typeof peakDbfs === "number" && Number.isFinite(peakDbfs)) {
      localStorage.setItem(GAIN_HINT_KEY, String(Math.round(peakDbfs * 10) / 10));
    }
  } catch {
    // ignore
  }
}
