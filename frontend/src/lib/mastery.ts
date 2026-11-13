/**
 * Learner-facing labels for the mastery stages the server computes
 * (clean takes on 3 different days, then spaced re-checks).
 */
import type { MasteryStage, PlanItem } from "./api";

export interface StageLike {
  stage?: MasteryStage | null;
  status?: string | null;
  clean_days?: number | null;
  clean_days_required?: number | null;
  next_due?: string | null;
  total_attempts?: number | null;
}

export type StageTone = "mastered" | "due" | "verifying" | "neutral";

const DAY_MS = 86_400_000;

/** "today", "tomorrow", "in 5 days", "in 3 weeks", or a short date. `now` is injectable for tests. */
export function relDate(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return "later";
  // next_due is a local calendar date (YYYY-MM-DD); compare whole days
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return "later";
  const due = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((due - today) / DAY_MS);
  if (days <= 0) return "today";
  if (days === 1) return "tomorrow";
  if (days < 14) return `in ${days} days`;
  if (days < 60) return `in ${Math.round(days / 7)} weeks`;
  return `in ${Math.round(days / 30)} months`;
}

/** The stage, falling back to the old status field for older responses. */
export function stageOf(c: StageLike): MasteryStage {
  if (c.stage) return c.stage;
  if (c.status === "mastered") return "mastered";
  return (c.total_attempts ?? 0) > 0 ? "learning" : "new";
}

export function stageLabel(c: StageLike, now: Date = new Date()): string {
  const required = c.clean_days_required ?? 3;
  switch (stageOf(c)) {
    case "new":
      return "Not started";
    case "learning":
      return "Learning";
    case "verifying":
      return `Clean day ${c.clean_days ?? 0} of ${required}`;
    case "mastered":
      return c.next_due ? `Mastered · re-check ${relDate(c.next_due, now)}` : "Mastered";
    case "due":
      return "Re-check due";
  }
}

export function stageTone(c: StageLike): StageTone {
  const s = stageOf(c);
  if (s === "mastered") return "mastered";
  if (s === "due") return "due";
  if (s === "verifying") return "verifying";
  return "neutral";
}

/** Tailwind classes for a stage chip: sage = mastered, amber = due, neutral otherwise. */
export const STAGE_CHIP: Record<StageTone, string> = {
  mastered: "text-emerald-200 border-emerald-300/35 bg-emerald-300/10",
  due: "text-amber-200 border-amber-300/40 bg-amber-300/10",
  verifying: "text-cream/90 border-cream/25 bg-cream/5",
  neutral: "text-gray-400 border-white/10 bg-white/[0.03]",
};

/** Title for a Today's Plan card. */
export function planTitle(item: PlanItem): string {
  const sym = item.chord_symbol ?? "";
  switch (item.type) {
    case "review":
      return `Re-check: ${sym}`;
    case "focus":
      return item.needs ? `${sym}: ${item.needs}` : `Focus: ${sym}`;
    case "new":
      return `New: ${sym}`;
    case "warmup":
      return `Warm up: ${sym}`;
    case "assignment":
      return `From your teacher: ${sym}`;
    case "transition":
      return `Changes: ${item.chord_a_symbol ?? ""} → ${item.chord_b_symbol ?? ""}`;
  }
}
