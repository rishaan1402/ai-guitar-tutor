/** Where each coach action button goes. */
import type { CoachAction } from "./api";
import { toAppChordKey } from "./chordpro";

export function actionHref(a: CoachAction): string {
  switch (a.type) {
    case "groove": {
      const q = new URLSearchParams({ ai: "1" });
      if (a.focus?.length === 2) q.set("focus", a.focus.join(","));
      if (a.style) q.set("style", a.style);
      return `/groove?${q}`;
    }
    case "practice": {
      const key = a.chord ? toAppChordKey(a.chord) : null;
      return key ? `/practice?chord=${encodeURIComponent(key)}` : "/practice";
    }
    case "tuner":
      return "/tuner";
    case "song":
      return "/practice?mode=song";
    default:
      return "/path";
  }
}
