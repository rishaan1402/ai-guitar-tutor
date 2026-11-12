import { describe, it, expect } from "vitest";
import { applyTake, cardFor, isGraded, nextUnclearStreak, takeVerdict } from "../verdict";
import { COPY, UNCLEAR_STREAK_NUDGE, micCheckHeadline, tuningCopy } from "../feedbackCopy";

describe("takeVerdict", () => {
  it("uses the server's top-level verdict when present", () => {
    expect(takeVerdict({ verdict: "unclear", evaluation: { issue: null, score: 1 } })).toBe("unclear");
    expect(takeVerdict({ verdict: "pass" })).toBe("pass");
    expect(takeVerdict({ verdict: "no_sound" })).toBe("no_sound");
  });

  it("derives it from the evaluation for older responses", () => {
    expect(takeVerdict({ evaluation: { issue: "unclear", score: 0.99 } })).toBe("unclear");
    expect(takeVerdict({ evaluation: { issue: "no_sound", score: 0 } })).toBe("no_sound");
    expect(takeVerdict({ evaluation: { issue: "processing_error", score: 0 } })).toBe("error");
    expect(takeVerdict({ evaluation: { issue: "unsupported_format", score: 0 } })).toBe("error");
    expect(takeVerdict({ evaluation: { issue: null, score: 1 } })).toBe("pass");
    expect(takeVerdict({ evaluation: { issue: "missing_note", score: 0.67 } })).toBe("fail");
    expect(takeVerdict({ evaluation: { issue: "wrong_chord", score: 0.33 } })).toBe("fail");
  });

  it("ignores an unknown verdict string", () => {
    expect(takeVerdict({ verdict: "maybe", evaluation: { issue: "unclear", score: 0.9 } })).toBe("unclear");
  });
});

describe("verdict → UI", () => {
  it("only pass/fail are graded; unclear → strum again; no sound / error → mic check", () => {
    expect(cardFor("pass")).toBe("graded");
    expect(cardFor("fail")).toBe("graded");
    expect(cardFor("unclear")).toBe("strum_again");
    expect(cardFor("no_sound")).toBe("mic_check");
    expect(cardFor("error")).toBe("mic_check");
    expect(isGraded("unclear")).toBe(false);
    expect(isGraded("no_sound")).toBe(false);
  });

  it("an unclear take leaves the score history unchanged", () => {
    const h = [{ attempt: 1, score: 0.67 }];
    expect(applyTake(h, "unclear", 2, 0.99)).toBe(h);
    expect(applyTake(h, "no_sound", 2, 0)).toBe(h);
    expect(applyTake(h, "error", 2, 0)).toBe(h);
    expect(applyTake(h, "pass", 2, 1)).toEqual([...h, { attempt: 2, score: 1 }]);
    expect(applyTake(h, "fail", 2, 0.33)).toHaveLength(2);
  });

  it("counts takes we couldn't grade in a row, reset by a graded one", () => {
    let n = 0;
    for (const v of ["unclear", "silent", "no_sound"] as const) n = nextUnclearStreak(n, v);
    expect(n).toBe(UNCLEAR_STREAK_NUDGE);
    expect(nextUnclearStreak(n, "fail")).toBe(0);
    expect(nextUnclearStreak(n, "pass")).toBe(0);
  });
});

describe("feedbackCopy", () => {
  it("has blame-free, actionable wording", () => {
    expect(COPY.micCheck).toMatch(/couldn't hear the guitar/i);
    expect(COPY.micCheck).toMatch(/green band/);
    expect(COPY.streakNudge).toBe("Still having trouble hearing you. Check the mic level and tuning.");
    expect(COPY.strumAgain).toBe("Strum again");
    for (const s of Object.values(COPY).flat()) expect(String(s)).not.toMatch(/wrong|bad|fail/i);
  });

  it("tuning copy names the direction and amount", () => {
    expect(tuningCopy(-31.6)).toMatch(/about 32 cents flat/);
    expect(tuningCopy(12)).toMatch(/12 cents sharp/);
  });

  it("mic-check headline by issue", () => {
    expect(micCheckHeadline("no_sound")).toBe(COPY.noSound);
    expect(micCheckHeadline("processing_error")).toBe(COPY.processingError);
  });
});
