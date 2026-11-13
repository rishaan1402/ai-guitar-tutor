import { describe, it, expect } from "vitest";
import { planTitle, relDate, stageLabel, stageTone } from "../mastery";
import { apiToProgressData, statusOf } from "../progress";
import type { ChordProgressItem, PlanItem } from "../api";

const NOW = new Date(2026, 10, 12, 15, 0, 0); // 12 Nov 2026, local

const item = (over: Partial<ChordProgressItem>): ChordProgressItem => ({
  chord_name: "C_major",
  best_score: 1,
  total_attempts: 4,
  last_practiced: "2026-11-12",
  status: "in_progress",
  stage: "learning",
  clean_days: 0,
  clean_days_required: 3,
  next_due: null,
  due: false,
  ...over,
});

describe("stageLabel", () => {
  it("covers all five stages", () => {
    expect(stageLabel(item({ stage: "new", total_attempts: 0 }), NOW)).toBe("Not started");
    expect(stageLabel(item({ stage: "learning" }), NOW)).toBe("Learning");
    expect(stageLabel(item({ stage: "verifying", clean_days: 2 }), NOW)).toBe("Clean day 2 of 3");
    expect(stageLabel(item({ stage: "mastered", status: "mastered", next_due: "2026-11-19" }), NOW)).toBe(
      "Mastered · re-check in 7 days",
    );
    expect(stageLabel(item({ stage: "due", due: true }), NOW)).toBe("Re-check due");
  });

  it("falls back to the status for older payloads (teacher view without stage)", () => {
    expect(stageLabel({ status: "mastered" }, NOW)).toBe("Mastered");
    expect(stageLabel({ status: "in_progress", total_attempts: 2 }, NOW)).toBe("Learning");
    expect(stageLabel({ stage: "verifying", clean_days: 1 }, NOW)).toBe("Clean day 1 of 3");
  });

  it("tones: sage mastered, amber due, neutral verifying", () => {
    expect(stageTone({ stage: "mastered" })).toBe("mastered");
    expect(stageTone({ stage: "due" })).toBe("due");
    expect(stageTone({ stage: "verifying" })).toBe("verifying");
    expect(stageTone({ stage: "learning" })).toBe("neutral");
  });

  it("relDate", () => {
    expect(relDate("2026-11-12", NOW)).toBe("today");
    expect(relDate("2026-11-13", NOW)).toBe("tomorrow");
    expect(relDate("2026-11-15", NOW)).toBe("in 3 days");
    expect(relDate("2026-12-10", NOW)).toBe("in 4 weeks");
    expect(relDate(null, NOW)).toBe("later");
  });
});

describe("ChordProgressItem parsing", () => {
  it("status: 'mastered' maps to mastered (the old `mastered` boolean is gone)", () => {
    const data = apiToProgressData({
      chords: [
        item({ chord_name: "E_minor", status: "mastered", stage: "mastered" }),
        item({ chord_name: "A_minor", status: "in_progress", stage: "verifying", clean_days: 2 }),
        item({ chord_name: "D_major", status: "not_attempted", stage: "new", total_attempts: 0 }),
      ],
      mastered_count: 1,
      total_attempted: 2,
      practice_streak: 4,
    });
    expect(data.chords.E_minor.status).toBe("mastered");
    expect(data.chords.A_minor.status).toBe("in_progress");
    expect(data.chords.D_major.status).toBe("not_attempted");
    expect(data.practiceStreak).toBe(4);
  });

  it("an unknown status is derived from attempts", () => {
    expect(statusOf({ status: "weird" as never, total_attempts: 3 })).toBe("in_progress");
    expect(statusOf({ status: undefined as never, total_attempts: 0 })).toBe("not_attempted");
  });
});

describe("planTitle", () => {
  const base: PlanItem = { type: "new", description: "New challenge (just above your current level)", chord_symbol: "Am" };
  it("drops the repeated 'New challenge' titles", () => {
    expect(planTitle(base)).toBe("New: Am");
    expect(planTitle({ ...base, type: "review" })).toBe("Re-check: Am");
    expect(planTitle({ ...base, type: "focus", needs: "one more clean day" })).toBe("Am: one more clean day");
    expect(planTitle({ ...base, type: "focus" })).toBe("Focus: Am");
    expect(planTitle({ type: "transition", description: "", chord_a_symbol: "Em", chord_b_symbol: "C" })).toBe("Changes: Em → C");
    for (const t of ["new", "review", "focus", "warmup", "assignment"] as const) {
      expect(planTitle({ ...base, type: t })).not.toMatch(/⭐|New challenge/);
    }
  });
});
