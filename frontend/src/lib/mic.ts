/**
 * Opening the microphone, shared by the recorder and onboarding so both ask
 * for exactly the same raw signal (no echo cancellation / noise suppression /
 * AGC, which smear chords and pump the level).
 */
export const MIC_CONSTRAINTS: MediaStreamConstraints = {
  audio: {
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
    channelCount: 1,
  },
};

/** getUserMedia with the app's constraints. No sampleRate: use the device's native rate. */
export function openMic(): Promise<MediaStream> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return Promise.reject(new DOMException("No getUserMedia", "NotSupportedError"));
  }
  return navigator.mediaDevices.getUserMedia(MIC_CONSTRAINTS);
}

export type MicErrorKind = "denied" | "not_found" | "busy" | "unsupported" | "other";

export function micErrorKind(err: unknown): MicErrorKind {
  const name = err instanceof DOMException || err instanceof Error ? err.name : "";
  if (name === "NotAllowedError" || name === "SecurityError" || name === "PermissionDeniedError") return "denied";
  if (name === "NotFoundError" || name === "DevicesNotFoundError" || name === "OverconstrainedError") return "not_found";
  if (name === "NotReadableError" || name === "AbortError" || name === "TrackStartError") return "busy";
  if (name === "NotSupportedError" || name === "TypeError") return "unsupported";
  return "other";
}

export function micErrorMessage(err: unknown): string {
  switch (micErrorKind(err)) {
    case "not_found":
      return "No microphone found. Plug one in and try again.";
    case "busy":
      return "Another app is using the microphone. Close it and try again.";
    case "unsupported":
      return "This browser can't use the microphone here. Try Chrome, Safari or Firefox.";
    default:
      return "Microphone access denied. Please allow microphone permissions.";
  }
}
