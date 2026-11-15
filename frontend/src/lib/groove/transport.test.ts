import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Transport, starsFor, summarise, type ChangeResult } from "./transport";
import type { Band } from "./band";
import type { Groove } from "./groove";

/** A band that only records what it was asked to play, on a clock we control. */
function fakeBand() {
  const ctx = { currentTime: 0, outputLatency: 0, baseLatency: 0, resume: () => Promise.resolve(), sampleRate: 48000 };
  const played: { t: number; chord: string | null; hold: boolean }[] = [];
  const band = {
    ctx,
    style: "pop",
    click: vi.fn(),
    playEighth: (t: number, _slot: number, chord: string | null, _d: number, o: { hold?: boolean } = {}) => played.push({ t, chord, hold: !!o.hold }),
  } as unknown as Band;
  return { band, ctx, played };
}

const G: Groove = { id: "t", title: "t", style: "pop", bpm: 120, bars: [["G"], ["C"]], strum: "D.D.D.D.", loops: 1, focus: ["G", "C"] };

/** Advance the clock in small steps, letting the scheduler run. */
function run(ctx: { currentTime: number }, to: number) {
  while (ctx.currentTime < to) {
    ctx.currentTime += 0.025;
    vi.advanceTimersByTime(25);
  }
}

describe("transport", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("wait mode holds at the change until the new chord is heard, then goes on", () => {
    const { band, ctx, played } = fakeBand();
    const results: ChangeResult[] = [];
    const t = new Transport(band, G, { mode: "wait", bpm: 120, full: false, onResult: (r) => results.push(r) });
    t.start();
    // 120 bpm: eighth = 0.25 s; count-in 2 s; G bar 2 s; change point at ~4.2 s
    run(ctx, 6);
    expect(t.isHolding()).toBe(true);
    expect(played.some((p) => p.hold)).toBe(true);
    expect(played.filter((p) => p.chord === "C")).toHaveLength(0);
    t.heard("C", ctx.currentTime);
    run(ctx, 7);
    expect(t.isHolding()).toBe(false);
    expect(played.some((p) => p.chord === "C")).toBe(true);
    expect(results).toHaveLength(1);
    // the music reached C at ~4.2 s and waited until 6.0 s (minus detection latency)
    expect(results[0].status).toBe("slow");
    expect(results[0].offset).toBeGreaterThan(1.5);
    expect(results[0].offset).toBeLessThan(1.8);
    t.stop();
  });

  it("a wrong chord doesn't release the hold", () => {
    const { band, ctx } = fakeBand();
    const t = new Transport(band, G, { mode: "wait", bpm: 120, full: false });
    t.start();
    run(ctx, 5);
    t.heard("G", ctx.currentTime);
    t.heard("Em", ctx.currentTime);
    run(ctx, 6);
    expect(t.isHolding()).toBe(true);
    t.stop();
  });

  it("changing early (before the change point) means no hold, scored on time", () => {
    const { band, ctx } = fakeBand();
    const results: ChangeResult[] = [];
    const t = new Transport(band, G, { mode: "wait", bpm: 120, full: false, onResult: (r) => results.push(r) });
    t.start();
    run(ctx, 3.6); // half a beat before the change
    t.heard("C", ctx.currentTime);
    run(ctx, 6);
    expect(t.isHolding()).toBe(false);
    expect(results[0]?.status).toBe("on_time");
    t.stop();
  });

  it("play mode scores on time, and a change nobody plays as missed", () => {
    const { band, ctx } = fakeBand();
    const results: ChangeResult[] = [];
    const g: Groove = { ...G, bars: [["G"], ["C"], ["G"]] };
    const t = new Transport(band, g, { mode: "play", bpm: 120, full: false, onResult: (r) => results.push(r) });
    t.start();
    run(ctx, 4.32 + 0.12); // C change point at ~4.2 s (+ detect latency)
    t.heard("C", ctx.currentTime);
    run(ctx, 8);
    expect(results.map((r) => r.status)).toEqual(["on_time", "missed"]);
    t.stop();
  });

  it("follow mode jumps ahead when you change early", () => {
    const { band, ctx, played } = fakeBand();
    const results: ChangeResult[] = [];
    const t = new Transport(band, { ...G, bars: [["G"], ["G"], ["C"]] }, { mode: "follow", bpm: 120, full: false, onResult: (r) => results.push(r) });
    t.start();
    run(ctx, 3); // a bar into G (two bars of G before C)
    t.heard("C", ctx.currentTime);
    run(ctx, 3.6);
    // C plays a whole bar sooner than written
    expect(played.some((p) => p.chord === "C" && p.t < 4.5)).toBe(true);
    expect(results[0]).toMatchObject({ status: "on_time" });
    t.stop();
  });

  it("stars and per-change summary", () => {
    const ch = (i: number, from: string, to: string) => ({ i, beat: 0, from, to, focus: from === "G" });
    const rs: ChangeResult[] = [
      { change: ch(0, "G", "C"), status: "on_time", offset: 0.1 },
      { change: ch(1, "C", "G"), status: "late", offset: 0.6 },
      { change: ch(2, "G", "C"), status: "on_time", offset: 0 },
    ];
    expect(starsFor(rs)).toBe(2);
    const s = summarise(rs);
    expect(s[0]).toMatchObject({ from: "G", to: "C", focus: true, total: 2, onTime: 2 });
    expect(s[1]).toMatchObject({ from: "C", to: "G", late: 1 });
  });
});

describe("3/4 time", () => {
  it("a waltz bar is three beats", async () => {
    const { timeline } = await import("./groove");
    const t = timeline({ id: "w", title: "w", style: "ballad", bpm: 90, bars: [["G"], ["C"]], strum: "D.D.D.", loops: 1, beatsPerBar: 3 });
    expect(t.totalBeats).toBe(6);
    expect(t.changes[0].beat).toBe(3);
  });
});
