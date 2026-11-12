/**
 * Maps a /submit_audio response to what the UI does with the take.
 *
 * Only "pass" and "fail" are graded: they enter the score history, local
 * progress and the song advisor. "unclear" gets the neutral "Strum again"
 * card; "no_sound" / "error" get the neutral mic-check card. None of the
 * ungraded ones ever show red, a score ring or a Missing list.
 */

export type Verdict = "pass" | "unclear" | "fail" | "no_sound" | "error";
export type TakeCard = "graded" | "strum_again" | "mic_check";

const VERDICTS: readonly Verdict[] = ["pass", "unclear", "fail", "no_sound", "error"];

export const UNGRADED_ISSUES: ReadonlySet<string> = new Set([
  "unclear",
  "no_sound",
  "processing_error",
  "unsupported_format",
]);

interface ResultLike {
  verdict?: unknown;
  evaluation?: { issue?: string | null; score?: number } | null;
}

/** The server's verdict when present; otherwise derived from the evaluation (older backends). */
export function takeVerdict(result: ResultLike | null | undefined): Verdict {
  const v = result?.verdict;
  if (typeof v === "string" && (VERDICTS as readonly string[]).includes(v)) return v as Verdict;
  const issue = result?.evaluation?.issue ?? null;
  if (issue === "unclear") return "unclear";
  if (issue === "no_sound") return "no_sound";
  if (issue === "processing_error" || issue === "unsupported_format") return "error";
  const score = result?.evaluation?.score ?? 0;
  return issue === null && score >= 1 ? "pass" : "fail";
}

export function isGraded(v: Verdict): boolean {
  return v === "pass" || v === "fail";
}

export function cardFor(v: Verdict): TakeCard {
  if (v === "unclear") return "strum_again";
  if (v === "no_sound" || v === "error") return "mic_check";
  return "graded";
}

export interface ScoreEntry {
  attempt: number;
  score: number;
}

/** Score history after a take: ungraded takes leave it untouched (same array). */
export function applyTake(history: ScoreEntry[], verdict: Verdict, attempt: number, score: number): ScoreEntry[] {
  return isGraded(verdict) ? [...history, { attempt, score }] : history;
}

/** Consecutive takes we couldn't grade (unclear, no sound, or a silent take the recorder dropped). */
export function nextUnclearStreak(streak: number, verdict: Verdict | "silent"): number {
  return verdict === "pass" || verdict === "fail" ? 0 : streak + 1;
}
