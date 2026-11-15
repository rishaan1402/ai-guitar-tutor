/**
 * Plays a Groove: schedules the band an eighth note at a time on the audio
 * clock, tells the highway where "now" is, and judges each chord change.
 *
 * Modes
 * - wait:   at each change the music holds (drums only) until you play the new chord.
 * - play:   the music keeps time; each change is scored on time / late / missed.
 * - follow: the music follows you: it waits when you're slow and jumps ahead when you change early.
 * - listen: hear it played (full band + guide guitar); no judging.
 */
import { Band } from "./band";
import { matchesExpected } from "./detect";
import { barBeats, strumSlots, timeline, type Change, type Groove, type Segment } from "./groove";
import { parseNote } from "./lead";

export type Mode = "wait" | "play" | "follow" | "listen";
export type ChangeStatus = "on_time" | "late" | "slow" | "missed";

export interface ChangeResult {
  change: Change;
  status: ChangeStatus;
  /** Seconds after the change point (negative = early). In wait mode: how long the music waited. */
  offset: number;
}

interface Step {
  time: number;
  eighth: number;
  hold: boolean;
}

export interface TransportOptions {
  mode: Mode;
  bpm: number;
  /** Full band (pad + guide guitar): only with headphones, or the band could fake a change. */
  full: boolean;
  onEnd?: () => void;
  onResult?: (r: ChangeResult) => void;
}

/** Time from a strum to the detector confirming it (analysis window + agreeing frames). */
const DETECT_LATENCY = 0.12;
const ON_TIME = 0.3;
const LATE = 1.0;
const WAIT_SLOW = 1.5;

export class Transport {
  readonly band: Band;
  readonly groove: Groove;
  readonly segments: Segment[];
  readonly changes: Change[];
  readonly totalBeats: number;
  private opts: TransportOptions;
  private eighthDur: number;
  private slots: string[];
  private barEighths: number;
  private steps: Step[] = [];
  private next = { time: 0, eighth: -8 };
  private holdSlot = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private ended = false;
  /** Audio time each change point was reached (scheduled, or the first held eighth). */
  private reachedAt = new Map<number, number>();
  private resolved = new Map<number, ChangeResult>();
  private outLatency: number;
  /** Latest chord the detector confirmed (it reports each chord once, so an early change must be remembered). */
  private lastHeard: { symbol: string; played: number } | null = null;
  /** When the previous change was settled: an "early" credit must come after it (a fresh pluck). */
  private lastSettled = -Infinity;

  constructor(band: Band, groove: Groove, opts: TransportOptions) {
    this.band = band;
    this.groove = groove;
    this.opts = opts;
    const t = timeline(groove);
    this.segments = t.segments;
    this.changes = t.changes;
    this.totalBeats = t.totalBeats;
    this.eighthDur = 60 / opts.bpm / 2;
    this.barEighths = barBeats(groove) * 2;
    this.slots = strumSlots(groove.strum, this.barEighths);
    band.style = groove.style;
    const ctx = band.ctx as AudioContext & { outputLatency?: number };
    this.outLatency = (ctx.outputLatency || 0) + (ctx.baseLatency || 0);
  }

  get mode() {
    return this.opts.mode;
  }

  start() {
    const ctx = this.band.ctx;
    void ctx.resume();
    this.next = { time: ctx.currentTime + 0.2, eighth: -this.barEighths };
    this.timer = setInterval(() => this.tick(), 25);
    this.tick();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private segmentAt(beat: number): Segment {
    let s = this.segments[0];
    for (const seg of this.segments) if (seg.start <= beat) s = seg;
    return s;
  }

  private changeAtEighth(e: number): Change | undefined {
    return this.changes.find((c) => c.beat * 2 === e);
  }

  private tick() {
    const ctx = this.band.ctx;
    while (this.timer && this.next.time < ctx.currentTime + 0.12) this.scheduleOne();
    // play mode: a change nobody played within the window is missed
    if (this.opts.mode === "play") {
      const heardNow = ctx.currentTime - this.outLatency;
      for (const c of this.changes) {
        const at = this.reachedAt.get(c.i);
        if (at !== undefined && !this.resolved.has(c.i) && heardNow - at > LATE) this.resolve(c, "missed", LATE);
      }
    }
  }

  private scheduleOne() {
    const { time, eighth: e } = this.next;
    const dur = this.eighthDur;
    if (e < 0) {
      if (e % 2 === 0) this.band.click(time, e === -this.barEighths);
      this.steps.push({ time, eighth: e, hold: false });
      this.next = { time: time + dur, eighth: e + 1 };
      return;
    }
    if (e >= this.totalBeats * 2) {
      this.stop();
      const wait = Math.max(0, (time - this.band.ctx.currentTime + this.outLatency) * 1000) + 600;
      setTimeout(() => this.finish(), wait);
      return;
    }
    const c = this.changeAtEighth(e);
    if (c && !this.reachedAt.has(c.i)) this.reachedAt.set(c.i, time);
    if (c) this.creditEarly(c);
    if ((this.opts.mode === "wait" || this.opts.mode === "follow") && c && !this.resolved.has(c.i)) {
      // hold here (drums only, so nothing but you sounds like a chord) until you change
      this.band.playEighth(time, this.holdSlot++ % this.barEighths, null, dur, { hold: true, waltz: this.barEighths === 6 });
      this.steps.push({ time, eighth: e, hold: true });
      this.next = { time: time + dur, eighth: e };
      return;
    }
    this.holdSlot = 0;
    const beat = e / 2;
    const seg = this.segmentAt(beat);
    const slot = e % this.barEighths;
    const full = this.opts.full || this.opts.mode === "listen";
    if (this.groove.kind === "lead") {
      // drums keep time; the guide guitar plays the melody when it's allowed to sound
      this.band.playEighth(time, slot, null, dur, { waltz: this.barEighths === 6 });
      const n = parseNote(seg.chord);
      if (full && n && seg.start * 2 === e) this.band.note(time, n.midi);
    } else {
      this.band.playEighth(time, slot, seg.chord, dur, {
        waltz: this.barEighths === 6,
        strum: this.slots[slot],
        full,
        padSeconds: seg.start * 2 === e ? seg.beats * 2 * dur : undefined,
      });
    }
    this.steps.push({ time, eighth: e, hold: false });
    if (this.steps.length > 600) this.steps.splice(0, 300);
    this.next = { time: time + dur, eighth: e + 1 };
  }

  /** You were already on the new chord when the change arrived: on time (early). */
  private creditEarly(c: Change) {
    if (this.resolved.has(c.i) || this.opts.mode === "listen" || !this.lastHeard) return;
    if (this.expected()?.i !== c.i || !matchesExpected(this.lastHeard.symbol, c.to)) return;
    if (this.lastHeard.played <= this.lastSettled) return;
    const at = (this.reachedAt.get(c.i) ?? 0) + this.outLatency;
    const off = this.lastHeard.played - at;
    // only a change made after the previous chord was settled counts (not a leftover)
    if (off > -this.eighthDur * 4) this.resolve(c, "on_time", Math.min(0, off));
  }

  private finish() {
    if (this.ended) return;
    this.ended = true;
    for (const c of this.changes) if (!this.resolved.has(c.i)) this.resolve(c, "missed", LATE);
    this.opts.onEnd?.();
  }

  /** Highway position in beats for an audio-clock time (what you're hearing now). */
  position(now = this.band.ctx.currentTime): number {
    const t = now - this.outLatency;
    for (let k = this.steps.length - 1; k >= 0; k--) {
      const s = this.steps[k];
      if (s.time <= t) {
        if (s.hold) return s.eighth / 2;
        return (s.eighth + Math.min(1, (t - s.time) / this.eighthDur)) / 2;
      }
    }
    return -4.5;
  }

  /** True while the music is waiting for you. */
  isHolding(now = this.band.ctx.currentTime): boolean {
    const t = now - this.outLatency;
    for (let k = this.steps.length - 1; k >= 0; k--) if (this.steps[k].time <= t) return this.steps[k].hold;
    return false;
  }

  /** The change the detector should expect next (its target chord gets a small head start). */
  expected(): Change | undefined {
    return this.changes.find((c) => !this.resolved.has(c.i));
  }

  /** The detector heard `symbol` (confirmed at audio time `time`). */
  heard(symbol: string, time: number) {
    if (this.opts.mode === "listen" || this.ended) return;
    const played = time - DETECT_LATENCY;
    this.lastHeard = { symbol, played };
    if (this.opts.mode === "follow") {
      const c = this.expected();
      if (!c || !matchesExpected(symbol, c.to)) return;
      const reached = this.reachedAt.get(c.i);
      if (reached === undefined) {
        // you changed early: jump the music to the change point to meet you
        if (this.next.eighth < c.beat * 2) this.next = { time: this.next.time, eighth: c.beat * 2 };
        this.resolve(c, "on_time", 0);
        return;
      }
      const waited = played - (reached + this.outLatency);
      this.resolve(c, waited <= ON_TIME ? "on_time" : waited <= WAIT_SLOW ? "late" : "slow", waited);
      return;
    }
    if (this.opts.mode === "wait") {
      const c = this.expected();
      if (!c || !matchesExpected(symbol, c.to)) return;
      // accept from a beat and a half before the change point
      if (this.position() < c.beat - 1.5) return;
      const reached = this.reachedAt.get(c.i);
      // the band reaches the change at `reached` + output latency (what you hear)
      const waited = reached === undefined ? -0.1 : played - (reached + this.outLatency);
      this.resolve(c, waited <= ON_TIME ? "on_time" : waited <= WAIT_SLOW ? "late" : "slow", waited);
      return;
    }
    // play: match the nearest unresolved change to this chord within the window
    let best: { c: Change; off: number } | null = null;
    for (const c of this.changes) {
      if (this.resolved.has(c.i) || !matchesExpected(symbol, c.to)) continue;
      const at = this.reachedAt.get(c.i);
      if (at === undefined) continue;
      const off = played - (at + this.outLatency);
      if (off < -0.4 || off > LATE) continue;
      if (!best || Math.abs(off) < Math.abs(best.off)) best = { c, off };
    }
    if (best) this.resolve(best.c, Math.abs(best.off) <= ON_TIME ? "on_time" : "late", best.off);
  }

  private resolve(c: Change, status: ChangeStatus, offset: number) {
    if (this.resolved.has(c.i)) return;
    const r = { change: c, status, offset };
    this.resolved.set(c.i, r);
    this.lastSettled = this.lastHeard?.played ?? this.band.ctx.currentTime;
    this.opts.onResult?.(r);
  }

  results(): ChangeResult[] {
    return this.changes.map((c) => this.resolved.get(c.i)).filter((r): r is ChangeResult => !!r);
  }
}

/** 0-3 stars from a run's changes. */
export function starsFor(results: ChangeResult[]): number {
  if (!results.length) return 0;
  const pts = results.reduce((s, r) => s + (r.status === "on_time" ? 1 : r.status === "late" ? 0.5 : r.status === "slow" ? 0.25 : 0), 0);
  const share = pts / results.length;
  return share >= 0.9 ? 3 : share >= 0.7 ? 2 : share >= 0.4 ? 1 : 0;
}

export interface PairSummary {
  from: string;
  to: string;
  focus: boolean;
  total: number;
  onTime: number;
  late: number;
  missed: number;
  /** Mean seconds late over the changes you made. */
  avgLate: number;
}

export function summarise(results: ChangeResult[]): PairSummary[] {
  const m = new Map<string, PairSummary & { sum: number; n: number }>();
  for (const r of results) {
    const k = `${r.change.from}>${r.change.to}`;
    const s = m.get(k) ?? { from: r.change.from, to: r.change.to, focus: r.change.focus, total: 0, onTime: 0, late: 0, missed: 0, avgLate: 0, sum: 0, n: 0 };
    s.total++;
    if (r.status === "on_time") s.onTime++;
    else if (r.status === "missed") s.missed++;
    else s.late++;
    if (r.status !== "missed") {
      s.sum += Math.max(0, r.offset);
      s.n++;
    }
    m.set(k, s);
  }
  return Array.from(m.values())
    .map(({ sum, n, ...s }) => ({ ...s, avgLate: n ? sum / n : 0 }))
    .sort((a, b) => Number(b.focus) - Number(a.focus) || a.onTime / a.total - b.onTime / b.total);
}
