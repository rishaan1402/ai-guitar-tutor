"use client";

/**
 * The play-along highway: chords come down toward the "now" line, with the
 * strum pattern in its own lane. Moves by transforming one column per frame
 * (no React render per frame), so it stays smooth on phones.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { strumSlots, type Change, type Segment } from "@/lib/groove/groove";
import { prettySymbol } from "@/lib/chordShape";
import { parseNote, STRING_NAMES } from "@/lib/groove/lead";

interface Props {
  segments: Segment[];
  changes: Change[];
  totalBeats: number;
  strum: string;
  /** Current position in beats (called every frame). */
  getPosition: () => number;
  /** Is the music waiting for you right now? */
  isHolding: () => boolean;
  /** Changes already judged, by index -> status (for colouring). */
  judged: Record<number, string>;
  /** Beats visible above the now line. */
  lookahead?: number;
  /** Lead: notes in six string lanes with fret numbers (no strum lane). */
  lead?: boolean;
}

const NOW = 0.8; // now line at 80% of the height

const LANE_COLORS: Record<number, string> = { 6: "#e8604f", 5: "#e8a54b", 4: "#e9d9b8", 3: "#86b092", 2: "#7da2c9", 1: "#c49be0" };

export default function Highway({ segments, changes, totalBeats, strum, getPosition, isHolding, judged, lookahead = 6, lead = false }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const column = useRef<HTMLDivElement>(null);
  const [h, setH] = useState(600);
  const [active, setActive] = useState(-1);
  const [holding, setHolding] = useState(false);
  const ppb = (h * NOW) / lookahead; // pixels per beat
  const slots = useMemo(() => strumSlots(strum), [strum]);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setH(el.clientHeight || 600));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let raf = 0;
    let lastActive = -2;
    let lastHold = false;
    const loop = () => {
      const pos = getPosition();
      if (column.current) column.current.style.transform = `translate3d(0, ${pos * ppb}px, 0)`;
      let idx = -1;
      // strictly past the start: at a change point (or waiting on it) the old chord is still "now"
      for (let k = 0; k < segments.length; k++) if (segments[k].start < pos - 1e-6 || (k === 0 && pos >= 0)) idx = k;
      if (idx !== lastActive) setActive((lastActive = idx));
      const hold = isHolding();
      if (hold !== lastHold) setHolding((lastHold = hold));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [getPosition, isHolding, ppb, segments]);

  const yNow = h * NOW;
  // y of beat b inside the column (the column itself moves down by pos*ppb)
  const y = (b: number) => yNow - b * ppb;
  const changeAt = useMemo(() => new Map(changes.map((c) => [c.beat, c])), [changes]);
  const next = segments[active + 1];

  return (
    <div ref={wrap} className="relative h-full w-full overflow-hidden rounded-[22px] border border-cream/10 bg-[linear-gradient(to_bottom,#100d0b,#1a1410)]">
      {/* lanes */}
      {lead ? (
        [6, 5, 4, 3, 2, 1].map((st, k) => (
          <div key={st} className="absolute inset-y-0 border-l border-cream/[0.06]" style={{ left: `${10 + k * 14.5}%`, width: "14.5%" }}>
            <div className="absolute inset-y-0 left-1/2 w-px" style={{ background: LANE_COLORS[st], opacity: 0.25 }} />
            <span className="label-mono absolute bottom-2 left-1/2 -translate-x-1/2 text-[11px] text-cream/40">{STRING_NAMES[st]}</span>
          </div>
        ))
      ) : (
        <>
          <div className="absolute inset-y-0 left-[16%] right-[30%] border-x border-cream/[0.06] bg-cream/[0.015]" />
          <div className="absolute inset-y-0 right-[4%] w-[22%] border-x border-cream/[0.06]" />
        </>
      )}

      <div ref={column} className="absolute inset-x-0 top-0 will-change-transform">
        {/* bar lines */}
        {Array.from({ length: Math.ceil(totalBeats / 4) + 1 }, (_, bar) => (
          <div key={`bar${bar}`} className="absolute left-[8%] right-[4%] h-px bg-cream/10" style={{ top: y(bar * 4) }}>
            <span className="label-mono absolute -top-2 left-0 -translate-x-full pr-1 text-[10px] text-cream/30">{bar + 1}</span>
          </div>
        ))}
        {/* chord boxes */}
        {lead && segments.map((s, k) => {
          const n = parseNote(s.chord);
          if (!n) return null;
          const c = changeAt.get(s.start);
          const status = c ? judged[c.i] : undefined;
          const lane = 6 - n.string;
          const isActive = k === active;
          return (
            <div
              key={k}
              className={`absolute flex items-center justify-center rounded-xl border-2 font-display transition-colors ${k < active ? "opacity-35" : ""}`}
              style={{
                left: `calc(${10 + lane * 14.5}% + 3px)`,
                width: "calc(14.5% - 6px)",
                top: y(s.start + Math.min(s.beats, 1)) + 2,
                height: Math.max(26, Math.min(s.beats, 1) * ppb - 4),
                borderColor: LANE_COLORS[n.string],
                background: isActive ? LANE_COLORS[n.string] : `${LANE_COLORS[n.string]}33`,
                color: isActive ? "#0c0a09" : "#f3ead8",
                fontSize: Math.min(26, ppb * 0.5),
              }}
              aria-label={`String ${n.string}, fret ${n.fret}`}
            >
              {n.fret}
              {status && <span className={`absolute -right-1 -top-1 h-3 w-3 rounded-full ${status === "on_time" ? "bg-sage-300" : status === "missed" ? "bg-amp-400" : "bg-amber-300"}`} />}
            </div>
          );
        })}
        {!lead && segments.map((s, k) => {
          const c = changeAt.get(s.start);
          const status = c ? judged[c.i] : undefined;
          const isActive = k === active;
          const past = k < active;
          return (
            <div
              key={k}
              className={`absolute left-[17%] right-[31%] flex items-start justify-between overflow-hidden rounded-2xl border px-3 pt-2 transition-colors duration-150 ${
                isActive
                  ? "border-amber-300/80 bg-amber-400/20"
                  : c?.focus
                    ? "border-amber-400/40 bg-cream/[0.06]"
                    : "border-cream/15 bg-cream/[0.05]"
              } ${past ? "opacity-35" : ""}`}
              style={{ top: y(s.start + s.beats) + 3, height: s.beats * ppb - 6 }}
            >
              <span className={`font-display leading-none ${isActive ? "text-amber-100" : "text-cream"}`} style={{ fontSize: Math.min(44, ppb * 0.9) }}>
                {prettySymbol(s.chord)}
              </span>
              {c?.focus && <span className="label-mono mt-1 text-[10px] text-amber-300">focus</span>}
              {status && (
                <span
                  className={`absolute bottom-1.5 right-2 label-mono text-[10px] ${
                    status === "on_time" ? "text-sage-300" : status === "missed" ? "text-amp-400" : "text-amber-300"
                  }`}
                >
                  {status === "on_time" ? "✓ on time" : status === "missed" ? "missed" : "late"}
                </span>
              )}
            </div>
          );
        })}
        {/* strum arrows, one per eighth note */}
        {!lead && Array.from({ length: totalBeats * 2 }, (_, e) => {
          const s = slots[e % 8];
          if (s === ".") return null;
          return (
            <span
              key={`s${e}`}
              className={`absolute right-[4%] flex w-[22%] -translate-y-1/2 items-center justify-center font-semibold ${s === "D" ? "text-cream/80" : "text-cream/45"}`}
              style={{ top: y(e / 2), fontSize: Math.min(26, ppb * 0.42) }}
              aria-hidden="true"
            >
              {s === "D" ? "↓" : "↑"}
            </span>
          );
        })}
      </div>

      {/* now line */}
      <div className="pointer-events-none absolute inset-x-0" style={{ top: yNow }}>
        <div className={`h-[3px] ${holding ? "bg-amber-300 shadow-[0_0_24px_rgba(232,165,75,0.9)]" : "bg-amber-400/80 shadow-[0_0_14px_rgba(232,165,75,0.5)]"}`} />
      </div>
      {holding && next && (
        <div className="pointer-events-none absolute inset-x-0 flex justify-center" style={{ top: yNow + 14 }}>
          <span className="animate-pulse rounded-full bg-amber-400 px-4 py-1.5 font-semibold text-ink-950">
            {lead && parseNote(next.chord) ? `Play string ${parseNote(next.chord)!.string}, fret ${parseNote(next.chord)!.fret}` : `Play ${prettySymbol(next.chord)}`}
          </span>
        </div>
      )}
      {/* fade at the top so chords appear softly */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-[#100d0b] to-transparent" />
    </div>
  );
}
