/**
 * Running inside the Android app (Capacitor) or a normal browser.
 * Everything here is safe to call on the server and in the browser.
 */
import { Capacitor } from "@capacitor/core";

export function isNativeApp(): boolean {
  return typeof window !== "undefined" && Capacitor.isNativePlatform();
}

/**
 * Lesson files shipped inside the APK (scripts/bundle-lessons.mjs copies them), so lessons open
 * instantly and offline. '#' can't be trusted in a local file path, so C#_major -> Csharp_major.
 */
export function bundledLessonPath(chord: string, file: "lesson.mp4" | "reference.wav"): string {
  return `/lessons/${chord.replace(/#/g, "sharp")}/${file}`;
}

/** Key the inline boot script uses to carry a deep path across a reload in the app. */
export const INTENDED_PATH_KEY = "os:intended-path";
