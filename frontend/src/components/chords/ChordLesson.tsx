"use client";

/**
 * An animated chord lesson drawn live in the app, for any chord (the same
 * walk-through as the lesson videos, but instant, sharp and offline):
 *   the chord and its notes -> fingers go down one at a time with captions ->
 *   the strum, string by string -> "your turn".
 * Tap any string to hear it; step back and forth; switch to the barre shape.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { ChordFingering, FretPosition } from "@/lib/api";
import { describe, parseSymbol } from "@/lib/chords/quality";
import { playNotes } from "@/lib/path/synth";

const OPEN_MIDI: Record<number, number> = { 6: 40, 5: 45, 4: 50, 3: 55, 2: 59, 1: 64 };
const STRING_NAME: Record<number, string> = { 6: "low E", 5: "A", 4: "D", 3: "G", 2: "B", 1: "high e" };

interface Beat {
  kind: "title" | "finger" | "open" | "strum" | "ready";
  /** Positions placed on this beat (a barre places several at once). */
  place: FretPosition[];
  caption: string;
}

/** The lesson's beats, from a fingering. */
export function lessonBeats(symbol: string, positions: FretPosition[]): Beat[] {
  const spec = parseSymbol(symbol);
  const fretted = positions.filter((p) => !p.action && p.fret && p.fret > 0 && p.finger);
  const byFinger = new Map<number, FretPosition[]>();
  for (const p of fretted) byFinger.set(p.finger!, [...(byFinger.get(p.finger!) ?? []), p]);
  const beats: Beat[] = [
    { kind: "title", place: [], caption: spec ? `${describe(spec)} · notes ${spec.noteNames.join(" ")}` : symbol },
  ];
  for (const f of Array.from(byFinger.keys()).sort((a, b) => a - b)) {
    const group = byFinger.get(f)!;
    if (group.length > 1) {
      const strings = group.map((p) => p.string);
      beats.push({
        kind: "finger",
        place: group,
        caption: `Finger ${f} lies flat across strings ${Math.max(...strings)}–${Math.min(...strings)} at fret ${group[0].fret}`,
      });
    } else {
      const p = group[0];
      beats.push({ kind: "finger", place: group, caption: `Finger ${f} · ${STRING_NAME[p.string]} string · fret ${p.fret} (${p.note})` });
    }
  }
  const open = positions.filter((p) => p.fret === 0 && !p.action).map((p) => p.string);
  const muted = positions.filter((p) => p.action === "mute").map((p) => p.string);
  if (open.length || muted.length) {
    const bits = [];
    if (open.length) bits.push(`Let ${open.map((s) => STRING_NAME[s]).join(", ")} ring open`);
    if (muted.length) bits.push(`don't play ${muted.map((s) => STRING_NAME[s]).join(", ")}`);
    beats.push({ kind: "open", place: [], caption: bits.join("; ") });
  }
  beats.push({ kind: "strum", place: [], caption: "Strum from the lowest played string down, and let every string ring" });
  beats.push({ kind: "ready", place: [], caption: "Your turn: make the shape and strum" });
  return beats;
}

const midiOf = (p: FretPosition) => OPEN_MIDI[p.string] + (p.fret ?? 0);

export default function ChordLesson({ symbol, fingering, autoPlay = false }: { symbol: string; fingering: ChordFingering; autoPlay?: boolean }) {
  const [useAlt, setUseAlt] = useState(false);
  const positions = useAlt && fingering.alt_positions ? fingering.alt_positions : fingering.positions;
  const beats = useMemo(() => lessonBeats(symbol, positions), [symbol, positions]);
  const [i, setI] = useState(autoPlay ? 0 : beats.length - 1);
  const [playing, setPlaying] = useState(autoPlay);
  const [ringing, setRinging] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const beat = beats[Math.min(i, beats.length - 1)];

  // which fretted notes are down by this beat
  const placed = useMemo(() => {
    const set = new Set<FretPosition>();
    beats.slice(0, i + 1).forEach((b) => b.place.forEach((p) => set.add(p)));
    if (beat.kind === "strum" || beat.kind === "ready" || beat.kind === "open") positions.forEach((p) => set.add(p));
    return set;
  }, [beats, i, beat.kind, positions]);

  const strum = () => {
    const ringOrder = positions.filter((p) => !p.action).sort((a, b) => b.string - a.string);
    playNotes(ringOrder.map(midiOf), 0.12);
    ringOrder.forEach((p, k) => setTimeout(() => setRinging(p.string), k * 120));
    setTimeout(() => setRinging(null), ringOrder.length * 120 + 500);
  };

  // auto-advance; strum when the strum beat arrives
  useEffect(() => {
    if (!playing) return;
    if (beat.kind === "strum") strum();
    if (i >= beats.length - 1) {
      setPlaying(false);
      return;
    }
    timer.current = setTimeout(() => setI((k) => k + 1), beat.kind === "title" ? 1600 : beat.kind === "strum" ? 2000 : 1300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, i]);

  useEffect(() => {
    setI(autoPlay ? 0 : beats.length - 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useAlt]);

  // the box: five frets from the lowest fretted note (or the nut)
  const frets = positions.filter((p) => !p.action && (p.fret ?? 0) > 0).map((p) => p.fret!);
  const top = frets.length && Math.max(...frets) > 5 ? Math.min(...frets) : 1;
  const W = 220, H = 280, left = 34, gap = 30, rowH = 40, y0 = 52;
  const x = (s: number) => left + (6 - s) * gap;
  const yFret = (f: number) => y0 + (f - top + 0.5) * rowH;

  const barres = beats
    .filter((b) => b.place.length > 1 && b.place.every((p) => placed.has(p)))
    .map((b) => ({ fret: b.place[0].fret!, from: Math.max(...b.place.map((p) => p.string)), to: Math.min(...b.place.map((p) => p.string)), finger: b.place[0].finger }));

  return (
    <div className="rounded-[22px] border border-cream/10 bg-ink-900/60 p-3">
      <div className="grid items-center gap-3 landscape:grid-cols-[auto_1fr]">
        <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto h-auto w-full max-w-[240px] short:max-w-[180px]" role="img" aria-label={`${symbol} chord shape`}>
          <text x={W / 2} y={20} textAnchor="middle" fontSize="20" fontWeight="800" fill="rgb(var(--text))">{symbol}</text>
          {/* nut or position */}
          {top === 1 ? (
            <rect x={left - 2} y={y0 - 4} width={gap * 5 + 4} height={5} fill="rgb(var(--text))" rx="1" />
          ) : (
            <text x={left - 10} y={y0 + rowH * 0.6} textAnchor="end" fontSize="12" fill="rgb(var(--acc-400))">{top}fr</text>
          )}
          {Array.from({ length: 6 }, (_, k) => (
            <line key={k} x1={left} x2={left + gap * 5} y1={y0 + k * rowH} y2={y0 + k * rowH} stroke="rgba(var(--cream-rgb),0.3)" strokeWidth="1.5" />
          ))}
          {[6, 5, 4, 3, 2, 1].map((s) => (
            <g key={s} onClick={() => { const p = positions.find((q) => q.string === s); if (p && !p.action) { playNotes([midiOf(p)]); setRinging(s); setTimeout(() => setRinging(null), 600); } }} style={{ cursor: "pointer" }}>
              <rect x={x(s) - 12} y={y0 - 30} width={24} height={rowH * 5 + 34} fill="transparent" />
              <line x1={x(s)} x2={x(s)} y1={y0} y2={y0 + rowH * 5} stroke={ringing === s ? "rgb(var(--acc-400))" : "rgba(var(--cream-rgb),0.55)"} strokeWidth={ringing === s ? 3 : 0.8 + s * 0.25} className="transition-[stroke] duration-150" />
            </g>
          ))}
          {/* open / muted markers */}
          {positions.map((p) =>
            p.action === "mute" ? (
              <text key={`m${p.string}`} x={x(p.string)} y={y0 - 12} textAnchor="middle" fontSize="13" fill="rgb(var(--live-400))" opacity={placed.has(p) || i >= beats.length - 1 ? 1 : 0.25}>×</text>
            ) : p.fret === 0 ? (
              <circle key={`o${p.string}`} cx={x(p.string)} cy={y0 - 16} r="5" fill="none" stroke="rgb(var(--ok-300))" strokeWidth="1.6" opacity={placed.has(p) || i >= beats.length - 1 ? 1 : 0.25} />
            ) : null,
          )}
          {/* barres */}
          {barres.map((b, k) => (
            <rect key={k} x={x(b.from) - 10} y={yFret(b.fret) - 10} width={x(b.to) - x(b.from) + 20} height={20} rx="10" fill="rgb(var(--acc-400))" className="animate-enter-fast" />
          ))}
          {/* fingers */}
          {positions.filter((p) => !p.action && (p.fret ?? 0) > 0).map((p) => {
            const on = placed.has(p);
            const isNew = beat.place.includes(p);
            return (
              <g key={`f${p.string}`} style={{ opacity: on ? 1 : 0, transition: "opacity 220ms" }}>
                <circle cx={x(p.string)} cy={yFret(p.fret!)} r={isNew ? 13 : 11} fill={isNew ? "rgb(var(--acc-400))" : "rgb(var(--text))"} stroke="rgb(var(--ink-950))" strokeWidth="1.5" className="transition-all duration-200" />
                <text x={x(p.string)} y={yFret(p.fret!) + 4.5} textAnchor="middle" fontSize="12" fontWeight="700" fill="rgb(var(--ink-950))">{p.finger ?? ""}</text>
              </g>
            );
          })}
          {/* note names under the strings */}
          {positions.map((p) => (
            <text key={`n${p.string}`} x={x(p.string)} y={y0 + rowH * 5 + 16} textAnchor="middle" fontSize="10" fill={p.action ? "rgba(var(--cream-rgb),0.2)" : "rgba(var(--cream-rgb),0.6)"} fontFamily="monospace">
              {p.action ? "" : p.note}
            </text>
          ))}
        </svg>
        <div className="space-y-3 text-center landscape:text-left">
          <p className="label-mono text-[10px] text-amber-400">{beat.kind === "title" ? "The chord" : beat.kind === "finger" ? `Step ${i} of ${beats.length - 1}` : beat.kind === "strum" ? "Hear it" : beat.kind === "ready" ? "Your turn" : "Open and muted strings"}</p>
          <p className="min-h-[3rem] text-[15px] font-semibold text-cream" aria-live="polite">{beat.caption}</p>
          <div className="flex flex-wrap justify-center gap-2 landscape:justify-start">
            <button onClick={() => { setI(0); setPlaying(true); }} className="h-10 rounded-full bg-amber-400 px-4 text-sm font-semibold text-ink-950">▶ {i === 0 && !playing ? "Play the lesson" : "Replay"}</button>
            <button disabled={i === 0} onClick={() => { setPlaying(false); setI((k) => Math.max(0, k - 1)); }} className="h-10 w-10 rounded-full border border-cream/15 text-cream/80 disabled:opacity-30" aria-label="Previous step">‹</button>
            <button disabled={i >= beats.length - 1} onClick={() => { setPlaying(false); setI((k) => Math.min(beats.length - 1, k + 1)); }} className="h-10 w-10 rounded-full border border-cream/15 text-cream/80 disabled:opacity-30" aria-label="Next step">›</button>
            <button onClick={strum} className="h-10 rounded-full border border-cream/15 px-4 text-sm text-cream/85">♪ Strum</button>
          </div>
          {fingering.alt_positions && (
            <button onClick={() => setUseAlt((v) => !v)} className="text-sm text-amber-300 underline-offset-4 hover:underline">
              {useAlt ? "Show the easier shape" : "Show a barre shape up the neck"}
            </button>
          )}
          <p className="text-xs text-cream/45">Tap any string to hear its note.</p>
        </div>
      </div>
    </div>
  );
}
