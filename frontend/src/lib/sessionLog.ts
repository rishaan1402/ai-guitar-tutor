/**
 * This practice session's takes, kept in memory with a sessionStorage backup
 * so a reload doesn't lose them. Works signed out; for signed-in learners the
 * server recap adds stage changes, and this log adds the takes the server
 * never stores (unclear, out of tune).
 */
import type { Verdict } from "./verdict";

/** Server verdicts, plus takes the recorder dropped before upload. */
export type LoggedVerdict = Verdict | "silent" | "dropped";

export interface LoggedTake {
  chord: string;
  verdict: LoggedVerdict;
  score: number | null;
  issue: string | null;
  tuning_cents: number | null;
  missing_notes?: string[];
  /** ms since epoch */
  t: number;
}

export interface SessionLog {
  /** ISO timestamp (UTC, with Z) when the practice page opened. */
  startedAt: string;
  takes: LoggedTake[];
}

const KEY = "agt:session-log";
/** A log older than this since its last activity starts a new session. */
export const SESSION_IDLE_MS = 30 * 60 * 1000;
/** "Finish session" appears after this many graded takes. */
export const RECAP_MIN_GRADED = 3;
/** …and on New Chord / Done after this many takes (silent / dropped excluded). */
export const RECAP_MIN_TAKES = 3;

export function newLog(now: number = Date.now()): SessionLog {
  return { startedAt: new Date(now).toISOString(), takes: [] };
}

/** Pure append (returns a new log). */
export function appendTake(log: SessionLog, take: LoggedTake): SessionLog {
  return { ...log, takes: [...log.takes, take] };
}

/** Silent / dropped takes never reached the server: they don't count anywhere. */
export function isCounted(t: LoggedTake): boolean {
  return t.verdict !== "silent" && t.verdict !== "dropped";
}

export function isGradedTake(t: LoggedTake): boolean {
  return t.verdict === "pass" || t.verdict === "fail";
}

export function countedTakes(log: SessionLog): LoggedTake[] {
  return log.takes.filter(isCounted);
}

export function gradedCount(log: SessionLog): number {
  return log.takes.filter(isGradedTake).length;
}

/** Whether to offer "Finish session" on Review. */
export function canFinish(log: SessionLog): boolean {
  return gradedCount(log) >= RECAP_MIN_GRADED;
}

/** Whether New Chord / Done should open the recap first. */
export function recapOnLeave(log: SessionLog): boolean {
  return countedTakes(log).length >= RECAP_MIN_TAKES;
}

/** Minutes from the first counted take to the last (at least 1 when there were takes). */
export function sessionMinutes(log: SessionLog): number {
  const ts = countedTakes(log).map((t) => t.t);
  if (!ts.length) return 0;
  return Math.max(1, Math.round((Math.max(...ts) - Math.min(...ts)) / 60000 + 0.5));
}

function storage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

function valid(x: unknown): x is SessionLog {
  const l = x as SessionLog;
  return !!l && typeof l.startedAt === "string" && Array.isArray(l.takes);
}

/** The stored log if it is still fresh, else a new one. */
export function loadLog(now: number = Date.now()): SessionLog {
  try {
    const raw = storage()?.getItem(KEY);
    if (raw) {
      const l = JSON.parse(raw);
      if (valid(l)) {
        const last = l.takes.length ? l.takes[l.takes.length - 1].t : Date.parse(l.startedAt);
        if (now - last < SESSION_IDLE_MS) return l;
      }
    }
  } catch {
    // ignore unreadable storage
  }
  return newLog(now);
}

export function saveLog(log: SessionLog): void {
  try {
    storage()?.setItem(KEY, JSON.stringify(log));
  } catch {
    // storage full / blocked: the in-memory copy still works
  }
}

export function clearLog(): void {
  try {
    storage()?.removeItem(KEY);
  } catch {
    // ignore
  }
}
