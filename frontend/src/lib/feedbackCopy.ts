/**
 * One place for the learner-facing wording of the "couldn't hear / not sure"
 * states (scout round-2 wording bank): name the cause, give one action, no blame.
 */

export const COPY = {
  /** Recorder: nothing strum-like arrived, or the take never got above the too-quiet floor. */
  micCheck:
    "I couldn't hear the guitar. Check the mic — the meter should reach the green band — and strum again.",
  /** Server said no_sound / unreadable audio. */
  noSound: "I couldn't hear that one clearly. Strum a bit harder, or move the phone closer to the soundhole.",
  /** The capture path skipped audio (busy device): the take wasn't uploaded. */
  deviceBusy: "Your device was busy and missed part of that — strum again. It doesn't count.",
  /** Neutral "tune" card (right shape, detuned guitar). */
  tuneHeadline: "Your guitar is out of tune",
  openTuner: "Open the tuner",
  processingError: "I couldn't read that recording. Strum once more — it doesn't count against you.",
  noisy: "Too much background sound to be sure. Try again in a quieter spot. This one doesn't count against you.",
  clipped: "That was loud enough to distort. Move the phone back a little.",
  unclearFallback: "I couldn't hear every string clearly — let the chord ring and strum once more.",
  doesntCount: "This one doesn't count.",
  strumAgain: "Strum again",
  listenFor: "Listen for",
  /** Borderline note that isn't in the chord (probably a string that should be muted). */
  maybeStray: "Maybe a stray",
  /** Shown after three takes in a row that we couldn't grade. */
  streakNudge: "Still having trouble hearing you. Check the mic level and tuning.",
  streakTips: [
    "Mic check: strum once and watch the strings light up (or the meter reach the green band).",
    "Move closer — about an arm's length from the soundhole.",
    "Tune up: a guitar that's out of tune can sound like a different chord.",
  ],
} as const;

/** Takes in a row we couldn't grade before the nudge appears. */
export const UNCLEAR_STREAK_NUDGE = 3;

export const LIVE_HINT: Record<"too_quiet" | "clipping", string> = {
  too_quiet: "Too quiet — move closer to the mic or strum harder.",
  clipping: "Clipping — back off from the mic a little.",
};

/** "about 12 cents sharp" (positive = sharp). */
export function centsPhrase(cents: number): string {
  return `${Math.round(Math.abs(cents))} cents ${cents < 0 ? "flat" : "sharp"}`;
}

/** "Your guitar sounds about 30 cents flat… Tune up first." (positive = sharp → tune down). */
export function tuningCopy(cents: number): string {
  return `Your guitar sounds about ${centsPhrase(cents)}, which can make right chords sound wrong. Tune ${cents > 0 ? "down" : "up"} first.`;
}

/** Headline for the neutral mic-check card, by server issue. */
export function micCheckHeadline(issue: string | null | undefined): string {
  if (issue === "processing_error" || issue === "unsupported_format") return COPY.processingError;
  return COPY.noSound;
}
