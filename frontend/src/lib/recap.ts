/**
 * The session recap's view model, from the server recap (signed in) and/or
 * the local session log (always). Pure: rendered by SessionRecap.
 */
import type { MasteryStage, PlanItem, SessionRecapResponse } from "./api";
import { formatChord } from "./chordName";
import { stageLabel, type StageLike } from "./mastery";
import { countedTakes, isGradedTake, sessionMinutes, type LoggedTake, type SessionLog } from "./sessionLog";

export interface RecapDot {
  /** 0..1 for graded takes; null for unclear / out of tune (hollow, on the baseline). */
  score: number | null;
  hollow: boolean;
}

export interface RecapRow {
  chordKey: string;
  symbol: string;
  bestScore: number | null;
  dots: RecapDot[];
  /** Stage chip (server) or local status label. */
  stage: StageLike | null;
  stageText: string;
  flags: string[];
  notSure: number;
}

export interface RecapNext {
  label: string;
  href: string;
}

export interface RecapView {
  source: "server" | "local";
  headline: string;
  minutes: number;
  takes: number;
  rows: RecapRow[];
  drills: string[];
  insight: string;
  next: RecapNext | null;
  streak: number | null;
}

/** Copy for the most common fail issue across the session. */
const ISSUE_INSIGHT: Record<string, (chord: string) => string> = {
  missing_note: (c) => `A chord tone kept dropping out on ${c} — press just behind the fret and let every string ring.`,
  muted_string: (c) => `A string kept getting muted on ${c} — arch your fingers so they don't touch the next string.`,
  extra_notes: (c) => `Extra strings rang on ${c} — mute the strings marked × with a fingertip or your thumb.`,
  wrong_chord: (c) => `Some ${c} takes sounded like a different chord — check each finger is on the right string.`,
};

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** One sentence: tuning drift first (it spoils everything), then the commonest fail, else praise. */
export function sessionInsight(takes: LoggedTake[]): string {
  const cents = takes.map((t) => t.tuning_cents).filter((c): c is number => typeof c === "number");
  if (cents.length >= 2 || takes.some((t) => t.verdict === "out_of_tune")) {
    const med = cents.length ? median(cents) : 0;
    if (Math.abs(med) > 15) {
      return `Tuning drifted about ${Math.round(Math.abs(med))} cents ${med > 0 ? "sharp" : "flat"} — tune before your next session.`;
    }
  }
  const fails = takes.filter((t) => t.verdict === "fail" && t.issue);
  if (fails.length) {
    const counts = new Map<string, { n: number; chord: string }>();
    for (const f of fails) {
      const k = f.issue as string;
      const c = counts.get(k) ?? { n: 0, chord: f.chord };
      c.n++;
      counts.set(k, c);
    }
    const [issue, { chord }] = Array.from(counts.entries()).sort((a, b) => b[1].n - a[1].n)[0];
    const copy = ISSUE_INSIGHT[issue];
    if (copy) return copy(formatChord(chord));
  }
  if (takes.some((t) => t.verdict === "out_of_tune")) return "Your guitar went out of tune — a quick tune-up will make takes count.";
  if (takes.some(isGradedTake)) return "Clean session — every graded take was a chord you can build on.";
  return "Every take helps the ear — try a few more strums next time so they can be graded.";
}

function dotsFor(takes: LoggedTake[]): RecapDot[] {
  return takes
    .filter((t) => isGradedTake(t) || t.verdict === "unclear" || t.verdict === "out_of_tune")
    .map((t) => (isGradedTake(t) ? { score: t.score ?? 0, hollow: false } : { score: null, hollow: true }));
}

function nextFromPlan(item: PlanItem | null | undefined): RecapNext | null {
  if (!item) return null;
  if (item.type === "transition" && item.chord_a_symbol && item.chord_b_symbol) {
    return { label: `${item.chord_a_symbol} → ${item.chord_b_symbol} changes`, href: "/practice?mode=transitions" };
  }
  if (item.chord_key) {
    return {
      label: item.chord_symbol || formatChord(item.chord_key),
      href: `/practice?chord=${encodeURIComponent(item.chord_key)}`,
    };
  }
  return null;
}

/** Group a log's counted takes by chord, in first-played order. */
function byChord(takes: LoggedTake[]): Map<string, LoggedTake[]> {
  const m = new Map<string, LoggedTake[]>();
  for (const t of takes) {
    const xs = m.get(t.chord) ?? [];
    xs.push(t);
    m.set(t.chord, xs);
  }
  return m;
}

export function buildRecap(
  log: SessionLog,
  server: SessionRecapResponse | null | undefined,
  localNext: RecapNext | null = null,
  now: Date = new Date(),
): RecapView {
  const takes = countedTakes(log);
  const local = byChord(takes);
  const insight = sessionInsight(takes);

  if (server) {
    const rows: RecapRow[] = server.chords.map((c) => {
      const mine = local.get(c.chord_key) ?? [];
      const item: StageLike = {
        stage: c.stage_after as MasteryStage,
        clean_days: c.clean_days,
        clean_days_required: c.clean_days_required,
      };
      const flags: string[] = [];
      if (server.newly_mastered.includes(c.chord_key)) flags.push("Mastered");
      else if (server.rechecked.includes(c.chord_key)) flags.push("Re-checked");
      else if (server.new_clean_days.includes(c.chord_key)) flags.push("New clean day");
      if (server.personal_bests.includes(c.chord_key)) flags.push("Personal best");
      return {
        chordKey: c.chord_key,
        symbol: c.chord_symbol || formatChord(c.chord_key),
        bestScore: c.best_score,
        dots: mine.length ? dotsFor(mine) : Array.from({ length: c.takes }, () => ({ score: null, hollow: false })),
        stage: item,
        stageText: stageLabel(item, now),
        flags,
        notSure: mine.filter((t) => !isGradedTake(t)).length,
      };
    });
    // chords played only as unclear / out-of-tune takes (never stored on the server)
    for (const [key, mine] of Array.from(local.entries())) {
      if (server.chords.some((c) => c.chord_key === key)) continue;
      rows.push(localRow(key, mine));
    }
    const drills = server.drills.map((d) => {
      const gain = d.prev_best_got != null ? d.got - d.prev_best_got : null;
      return `${formatChord(d.chord_a)} → ${formatChord(d.chord_b)}: ${d.got}${gain != null && gain !== 0 ? ` (${gain > 0 ? "+" : ""}${gain})` : ""}`;
    });
    return {
      source: "server",
      headline: server.headline,
      minutes: Math.max(server.minutes, sessionMinutes(log)),
      takes: Math.max(server.takes, takes.length),
      rows,
      drills,
      insight,
      next: nextFromPlan(server.next) ?? localNext,
      streak: server.streak,
    };
  }

  const rows = Array.from(local.entries()).map(([key, mine]) => localRow(key, mine));
  const minutes = sessionMinutes(log);
  return {
    source: "local",
    headline: `${minutes} minute${minutes === 1 ? "" : "s"}, ${rows.length} chord${rows.length === 1 ? "" : "s"}`,
    minutes,
    takes: takes.length,
    rows,
    drills: [],
    insight,
    next: localNext,
    streak: null,
  };
}

function localRow(key: string, mine: LoggedTake[]): RecapRow {
  const graded = mine.filter(isGradedTake);
  const best = graded.length ? Math.max(...graded.map((t) => t.score ?? 0)) : null;
  const flags: string[] = [];
  const passed = graded.some((t) => t.verdict === "pass");
  return {
    chordKey: key,
    symbol: formatChord(key),
    bestScore: best,
    dots: dotsFor(mine),
    stage: null,
    stageText: passed ? "Clean take · on this device" : graded.length ? "Getting there" : "Not graded yet",
    flags,
    notSure: mine.filter((t) => !isGradedTake(t)).length,
  };
}
