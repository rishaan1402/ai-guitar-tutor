import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import {
  appendTake,
  canFinish,
  countedTakes,
  gradedCount,
  loadLog,
  newLog,
  recapOnLeave,
  saveLog,
  sessionMinutes,
  type LoggedTake,
  type SessionLog,
} from "../sessionLog";
import { buildRecap, sessionInsight } from "../recap";
import type { SessionRecapResponse } from "../api";
import { SessionRecap } from "../../app/practice/_components/SessionRecap";

const T0 = Date.UTC(2026, 10, 12, 18, 0, 0);
const take = (over: Partial<LoggedTake> & { t: number }): LoggedTake => ({
  chord: "C_major",
  verdict: "pass",
  score: 1,
  issue: null,
  tuning_cents: null,
  ...over,
});

/** The critic's acceptance session: C pass, C unclear, C pass, G-for-C fail, plus a silent take. */
function session(): SessionLog {
  let log = newLog(T0);
  log = appendTake(log, take({ t: T0 + 10_000 }));
  log = appendTake(log, take({ t: T0 + 60_000, verdict: "silent", score: null }));
  log = appendTake(log, take({ t: T0 + 90_000, verdict: "unclear", score: null, issue: "unclear" }));
  log = appendTake(log, take({ t: T0 + 150_000 }));
  log = appendTake(
    log,
    take({ t: T0 + 240_000, chord: "G_major", verdict: "fail", score: 0.33, issue: "missing_note", missing_notes: ["D"] }),
  );
  return log;
}

describe("sessionLog", () => {
  beforeEach(() => sessionStorage.clear());

  it("appends immutably and excludes silent / dropped takes from counts", () => {
    const a = newLog(T0);
    const b = appendTake(a, take({ t: T0, verdict: "dropped", score: null }));
    expect(a.takes).toHaveLength(0);
    expect(b.takes).toHaveLength(1);
    expect(countedTakes(b)).toHaveLength(0);
    const log = session();
    expect(countedTakes(log)).toHaveLength(4);
    expect(gradedCount(log)).toBe(3);
    expect(sessionMinutes(log)).toBe(4);
  });

  it("offers Finish after 3 graded takes, and the recap on leave after 3 counted takes", () => {
    let log = newLog(T0);
    log = appendTake(log, take({ t: T0 }));
    log = appendTake(log, take({ t: T0 + 1, verdict: "unclear", score: null }));
    log = appendTake(log, take({ t: T0 + 2, verdict: "silent", score: null }));
    expect(canFinish(log)).toBe(false);
    expect(recapOnLeave(log)).toBe(false);
    log = appendTake(log, take({ t: T0 + 3, verdict: "out_of_tune", score: null }));
    expect(recapOnLeave(log)).toBe(true);
    expect(canFinish(session())).toBe(true);
  });

  it("round-trips through sessionStorage and starts fresh after 30 idle minutes", () => {
    const log = session();
    saveLog(log);
    expect(loadLog(T0 + 250_000).takes).toHaveLength(5);
    const stale = loadLog(T0 + 240_000 + 31 * 60_000);
    expect(stale.takes).toHaveLength(0);
  });
});

describe("recap from the local log (signed out)", () => {
  it("two rows; C best 100 % with 2 filled and 1 hollow dot; insight from the G take", () => {
    const v = buildRecap(session(), null, { label: "Am", href: "/practice?chord=A_minor" });
    expect(v.source).toBe("local");
    expect(v.headline).toBe("4 minutes, 2 chords");
    expect(v.takes).toBe(4);
    expect(v.rows.map((r) => r.chordKey)).toEqual(["C_major", "G_major"]);
    const c = v.rows[0];
    expect(c.bestScore).toBe(1);
    expect(c.dots.filter((d) => !d.hollow)).toHaveLength(2);
    expect(c.dots.filter((d) => d.hollow)).toHaveLength(1);
    expect(c.notSure).toBe(1);
    expect(v.insight).toMatch(/dropping out on G major/);
    expect(v.next?.href).toBe("/practice?chord=A_minor");
  });

  it("insight: tuning drift wins when the median |cents| > 15", () => {
    const takes = [
      take({ t: 1, verdict: "out_of_tune", score: null, tuning_cents: 22 }),
      take({ t: 2, verdict: "fail", score: 0.5, issue: "missing_note", tuning_cents: 18 }),
      take({ t: 3, tuning_cents: 4 }),
    ];
    expect(sessionInsight(takes)).toMatch(/Tuning drifted about 18 cents sharp/);
    expect(sessionInsight([take({ t: 1 })])).toMatch(/Clean session/);
  });
});

const SERVER: SessionRecapResponse = {
  started_at: "2026-11-12T18:00:10+00:00",
  ended_at: "2026-11-12T18:04:00+00:00",
  minutes: 3,
  takes: 3,
  graded_takes: 3,
  unclear_count: null,
  chords: [
    {
      chord_key: "C_major", chord_symbol: "C", takes: 2, first_score: 1, best_score: 1, last_score: 1, clean_takes: 2,
      stage_before: "learning", stage_after: "verifying", clean_days: 1, clean_days_required: 3,
    },
    {
      chord_key: "G_major", chord_symbol: "G", takes: 1, first_score: 0.33, best_score: 0.33, last_score: 0.33, clean_takes: 0,
      stage_before: "new", stage_after: "learning", clean_days: 0, clean_days_required: 3,
    },
  ],
  new_clean_days: ["C_major"],
  newly_mastered: [],
  rechecked: [],
  personal_bests: [],
  drills: [{ chord_a: "E_minor", chord_b: "A_minor", got: 22, prev_best_got: 18 }],
  streak: 4,
  next: { type: "new", chord_key: "A_minor", chord_symbol: "Am", description: "New" },
  headline: "C: clean day 1 of 3 — come back tomorrow for the next one.",
};

describe("recap from the server (signed in)", () => {
  it("uses the server headline, stages and next; dots (incl. unclear) from the local log", () => {
    const v = buildRecap(session(), SERVER, null);
    expect(v.source).toBe("server");
    expect(v.headline).toBe(SERVER.headline);
    expect(v.rows[0].stageText).toBe("Clean day 1 of 3");
    expect(v.rows[0].flags).toContain("New clean day");
    expect(v.rows[0].dots.filter((d) => d.hollow)).toHaveLength(1);
    expect(v.rows[1].stageText).toBe("Learning");
    expect(v.drills).toEqual(["E minor → A minor: 22 (+4)"]);
    expect(v.next).toEqual({ label: "Am", href: "/practice?chord=A_minor" });
    expect(v.streak).toBe(4);
  });

  it("a transition next links to the trainer", () => {
    const v = buildRecap(session(), {
      ...SERVER,
      next: { type: "transition", chord_a_symbol: "Em", chord_b_symbol: "C", description: "" },
    });
    expect(v.next?.href).toBe("/practice?mode=transitions");
  });
});

describe("<SessionRecap>", () => {
  beforeEach(() => cleanup());

  it("renders the server recap: h1 headline, one row per chord, streak, Next", () => {
    render(
      <SessionRecap view={buildRecap(session(), SERVER)} signedIn onNext={() => {}} onKeepGoing={() => {}} onDone={() => {}} />,
    );
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1.textContent).toBe(SERVER.headline);
    expect(document.activeElement).toBe(h1);
    expect(screen.getAllByTestId("recap-row")).toHaveLength(2);
    expect(screen.getByTestId("recap-streak").textContent).toBe("Day 4 streak");
    expect(screen.getByRole("button", { name: /Next: Am/ })).toBeTruthy();
  });

  it("renders the local recap for a guest with the sign-up line", () => {
    render(
      <SessionRecap view={buildRecap(session(), null)} signedIn={false} onNext={() => {}} onKeepGoing={() => {}} onDone={() => {}} />,
    );
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("4 minutes, 2 chords");
    expect(screen.getByText(/Save this progress/)).toBeTruthy();
    const hollow = document.querySelectorAll('[data-dot="hollow"]');
    expect(hollow.length).toBe(1);
  });
});
