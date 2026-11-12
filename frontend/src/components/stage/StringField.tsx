"use client";

import { useEffect, useRef, type MutableRefObject } from "react";
import { FrameGovernor, backingDpr } from "@/lib/frameGovernor";
import type { StringTarget, StringVerdict } from "@/lib/stringEnergy";

export type ListenState = "idle" | "armed" | "recording" | "done";

interface DecorProps {
  className?: string;
  /** "hero": bright, strums itself, reacts to the pointer. "ambient": dim backdrop. "listen": live stage. */
  variant?: "hero" | "ambient";
}

export interface ListenProps {
  className?: string;
  variant: "listen";
  /** Six targets, low E first (lib/stringEnergy `stringTargets`). */
  targets: StringTarget[];
  /** Six energies 0..1, low E first, written at audio rate (never React state). */
  energyRef?: MutableRefObject<Float32Array>;
  /** Six extra-note flashes 0..1. */
  extraRef?: MutableRefObject<Float32Array>;
  state: ListenState;
  /** Post-take per-string verdicts (state "done"). */
  verdicts?: StringVerdict[] | null;
  /** Accessible summary of what the stage shows. */
  label?: string;
}

type Props = DecorProps | ListenProps;

interface GuitarString {
  amp: number;    // current vibration amplitude in px
  freq: number;   // visual vibration speed
  phase: number;
  pluckU: number; // where along the string it was last plucked (0..1)
}

interface Mote {
  x: number; y: number; r: number; speed: number; alpha: number; twinkle: number;
}

const BRONZE: [number, number, number] = [217, 139, 43];
const CREAM: [number, number, number] = [243, 234, 216];
const SAGE: [number, number, number] = [134, 176, 146];

// Chord-tone "listening" nodes: [string index 0=low E, position along string]
const NODES: [number, number][] = [[1, 0.36], [2, 0.44], [4, 0.3], [3, 0.52], [5, 0.4]];

function mix(a: number[], b: number[], t: number) {
  return a.map((v, i) => Math.round(v + (b[i] - v) * t));
}

/**
 * Six guitar strings as glowing particle strands (the app's hero object).
 * Canvas 2D, no dependencies. Pauses when off-screen or the tab is hidden;
 * draws a single still frame for prefers-reduced-motion.
 */
export default function StringField(props: Props) {
  if (props.variant === "listen") return <ListenField {...props} />;
  return <DecorField className={props.className} variant={props.variant ?? "hero"} />;
}

/** `?perf=1`: a small ms/frame overlay and `window.__sfPerf` frame intervals for measurement. */
function perfProbe(label: string) {
  if (typeof window === "undefined" || !/[?&]perf=1\b/.test(window.location.search)) return null;
  const w = window as unknown as { __sfPerf?: Record<string, number[]> };
  w.__sfPerf = w.__sfPerf || {};
  const list: number[] = (w.__sfPerf[label] = []);
  const el = document.createElement("div");
  el.setAttribute("aria-hidden", "true");
  el.style.cssText =
    "position:fixed;left:8px;bottom:8px;z-index:9999;font:11px/1.3 ui-monospace,monospace;color:#f3ead8;background:rgba(0,0,0,.65);padding:4px 6px;border-radius:6px;pointer-events:none";
  document.body.appendChild(el);
  let lastPaint = 0;
  return {
    sample(dtMs: number, tier: number) {
      list.push(dtMs);
      if (list.length > 2000) list.splice(0, list.length - 2000);
      const now = performance.now();
      if (now - lastPaint > 500) {
        lastPaint = now;
        const recent = list.slice(-120).sort((a, b) => a - b);
        const p95 = recent[Math.floor(recent.length * 0.95)] ?? 0;
        const avg = recent.reduce((x, y) => x + y, 0) / Math.max(1, recent.length);
        el.textContent = `${label} ${avg.toFixed(1)} ms avg · p95 ${p95.toFixed(1)} · tier ${tier}`;
      }
    },
    dispose() {
      el.remove();
    },
  };
}

function DecorField({ className, variant }: { className?: string; variant: "hero" | "ambient" }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const hero = variant === "hero";
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let w = 0;
    let h = 0;
    let running = false;
    let frame = 0;
    let last = performance.now();
    let time = 0;
    let nextStrum = 1.2;
    const strumQueue: { i: number; at: number; strength: number }[] = [];

    const strings: GuitarString[] = Array.from({ length: 6 }, (_, i) => ({
      amp: 0,
      freq: 15 + i * 2.6,
      phase: Math.random() * Math.PI * 2,
      pluckU: 0.5,
    }));
    const motes: Mote[] = Array.from({ length: hero ? 80 : 45 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: Math.random() * 1.5 + 0.3,
      speed: Math.random() * 0.014 + 0.004,
      alpha: Math.random() * 0.45 + 0.1,
      twinkle: Math.random() * Math.PI * 2,
    }));
    const orbs = Array.from({ length: 6 }, (_, k) => ({
      x: Math.random(),
      y: 0.1 + Math.random() * 0.75,
      r: 90 + Math.random() * 170,
      alpha: 0.035 + Math.random() * 0.05,
      color: k % 3 === 0 ? SAGE : BRONZE,
      drift: Math.random() * Math.PI * 2,
    }));

    const governor = new FrameGovernor(`StringField:${variant}`);
    const probe = perfProbe(variant);

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = backingDpr(governor.quality.dpr, window.devicePixelRatio || 1, rect.width, rect.height);
      w = rect.width;
      h = rect.height;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    // Strings fan out to the right, like a neck seen at an angle
    const baseY = (i: number, x: number) => {
      const t = x / Math.max(w, 1);
      const gap = Math.min(h * 0.05, 40) * (0.7 + 0.6 * t);
      const centre = h * (hero ? 0.66 : 0.6) - (t - 0.5) * h * 0.2;
      return centre + (i - 2.5) * gap + Math.sin(t * Math.PI) * h * 0.025;
    };

    const displacement = (s: GuitarString, i: number, u: number) => {
      // Fundamental plus a second harmonic skewed toward the pluck point
      const shape = Math.sin(Math.PI * u) + 0.35 * Math.sin(2 * Math.PI * u) * (s.pluckU - 0.5) * 2;
      const vib = s.amp * shape * Math.sin(time * s.freq + s.phase);
      const idle = Math.sin(u * 9 + time * 1.2 + i * 1.7) * (hero ? 0.9 : 0.6);
      return vib + idle;
    };

    const pluck = (i: number, u: number, strength: number) => {
      const s = strings[i];
      s.amp = Math.min(Math.max(s.amp, strength), 18);
      s.pluckU = u;
    };

    const draw = (dt: number) => {
      time += dt;
      ctx.clearRect(0, 0, w, h);

      // Bokeh orbs (out-of-focus stage lights)
      for (const o of orbs) {
        const ox = (o.x + Math.sin(time * 0.05 + o.drift) * 0.02) * w;
        const oy = (o.y + Math.cos(time * 0.04 + o.drift) * 0.015) * h;
        const g = ctx.createRadialGradient(ox, oy, 0, ox, oy, o.r);
        g.addColorStop(0, `rgba(${o.color.join(",")},${o.alpha})`);
        g.addColorStop(1, `rgba(${o.color.join(",")},0)`);
        ctx.fillStyle = g;
        ctx.fillRect(ox - o.r, oy - o.r, o.r * 2, o.r * 2);
      }

      ctx.globalCompositeOperation = "lighter";

      // Dust motes drifting up through the light
      for (const m of motes) {
        m.y -= m.speed * dt;
        if (m.y < -0.02) {
          m.y = 1.02;
          m.x = Math.random();
        }
        const a = m.alpha * (0.6 + 0.4 * Math.sin(time * 1.5 + m.twinkle));
        ctx.fillStyle = `rgba(${CREAM.join(",")},${a * (hero ? 1 : 0.6)})`;
        ctx.beginPath();
        ctx.arc(m.x * w, m.y * h, m.r, 0, Math.PI * 2);
        ctx.fill();
      }

      const segs = Math.max(40, Math.round(w / governor.quality.segDiv));
      const xStart = -w * 0.05;
      const span = w * 1.1;

      strings.forEach((s, i) => {
        s.amp *= Math.pow(0.2, dt); // ring out over ~1.5 s
        const t = i / 5;
        const color = mix(BRONZE, CREAM, t).join(",");
        const thickness = 2.2 - t * 1.4; // wound bass strings are thicker
        const energy = Math.min(s.amp / 18, 1);
        const dim = hero ? 1 : 0.45;

        const pts: [number, number][] = [];
        for (let k = 0; k <= segs; k++) {
          const u = k / segs;
          const x = xStart + u * span;
          pts.push([x, baseY(i, x) + displacement(s, i, u)]);
        }

        // Glow, then the bright core
        const strokes: [number, number][] = governor.quality.glow
          ? [
              [thickness * 7, (0.05 + energy * 0.12) * dim],
              [thickness, (0.45 + energy * 0.45) * dim],
            ]
          : [[thickness, (0.45 + energy * 0.45) * dim]];
        for (const [width, alpha] of strokes) {
          ctx.strokeStyle = `rgba(${color},${alpha})`;
          ctx.lineWidth = width;
          ctx.beginPath();
          pts.forEach(([x, y], k) => (k === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
          ctx.stroke();
        }

        // Particle sparkle along the strand
        for (let k = 0; k <= segs; k += 2) {
          const u = k / segs;
          const sparkle = 0.5 + 0.5 * Math.sin(u * 47 + time * 3.1 + i * 2.3);
          if (sparkle < 0.55) continue;
          const [x, y] = pts[k];
          const jitter = Math.sin(u * 91 + time * 7 + i) * (1 + energy * 4);
          ctx.fillStyle = `rgba(${color},${(sparkle - 0.4) * (0.5 + energy * 0.5) * dim})`;
          ctx.fillRect(x, y + jitter, 1.4, 1.4);
        }
      });

      // Listening constellation: chord tones lit on the strings, joined by thin lines
      if (hero) {
        const pulse = 0.6 + 0.4 * Math.sin(time * 2.2);
        const nodePts = NODES.map(([i, u]) => {
          const x = xStart + u * span;
          return [x, baseY(i, x) + displacement(strings[i], i, u)] as const;
        });
        ctx.strokeStyle = `rgba(${CREAM.join(",")},${0.16 * pulse})`;
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        nodePts.forEach(([x, y], k) => (k === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
        ctx.stroke();
        for (const [x, y] of nodePts) {
          const g = ctx.createRadialGradient(x, y, 0, x, y, 16);
          g.addColorStop(0, `rgba(255,236,200,${0.5 * pulse})`);
          g.addColorStop(1, "rgba(255,236,200,0)");
          ctx.fillStyle = g;
          ctx.fillRect(x - 16, y - 16, 32, 32);
          ctx.fillStyle = "rgba(255,246,228,0.95)";
          ctx.beginPath();
          ctx.arc(x, y, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.globalCompositeOperation = "source-over";
    };

    const tick = (now: number) => {
      const dtMs = Math.max(0, now - last);
      const dt = Math.min(dtMs / 1000, 0.05);
      last = now;
      if (dtMs > 0) {
        probe?.sample(dtMs, governor.tier);
        if (governor.sample(dtMs)) resize();
      }
      if (hero) {
        nextStrum -= dt;
        if (nextStrum <= 0) {
          // A downstroke: low E to high e, a few ms apart
          const strength = 7 + Math.random() * 6;
          for (let i = 0; i < 6; i++) strumQueue.push({ i, at: time + i * 0.035, strength });
          nextStrum = 2.6 + Math.random() * 1.6;
        }
        for (let k = strumQueue.length - 1; k >= 0; k--) {
          if (strumQueue[k].at <= time) {
            pluck(strumQueue[k].i, 0.25 + Math.random() * 0.1, strumQueue[k].strength);
            strumQueue.splice(k, 1);
          }
        }
      }
      draw(dt);
      frame = requestAnimationFrame(tick);
    };

    const start = () => {
      if (running || reduceMotion) return;
      running = true;
      last = performance.now();
      frame = requestAnimationFrame(tick);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(frame);
    };

    // Pointer crossing a string plucks it
    let prev: { x: number; y: number } | null = null;
    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
        prev = null;
        return;
      }
      if (prev) {
        for (let i = 0; i < 6; i++) {
          const before = prev.y - baseY(i, prev.x);
          const after = y - baseY(i, x);
          if (Math.sign(before) !== Math.sign(after)) {
            const speed = Math.hypot(x - prev.x, y - prev.y);
            pluck(i, Math.min(Math.max((x + w * 0.05) / (w * 1.1), 0.05), 0.95), 4 + Math.min(speed * 0.35, 12));
          }
        }
      }
      prev = { x, y };
    };

    resize();
    draw(0);
    const ro = new ResizeObserver(() => {
      resize();
      if (!running) draw(0);
    });
    ro.observe(canvas);
    const io = new IntersectionObserver(([entry]) => (entry.isIntersecting && !document.hidden ? start() : stop()));
    io.observe(canvas);
    const onVisibility = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVisibility);
    if (hero) window.addEventListener("pointermove", onMove, { passive: true });

    return () => {
      stop();
      probe?.dispose();
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pointermove", onMove);
    };
  }, [variant]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}

// ── Listen variant: the live listening stage ─────────────────────────────────

const AMBER: [number, number, number] = [239, 194, 122];
const CORAL: [number, number, number] = [222, 122, 92];
const LISTEN_SAGE: [number, number, number] = [134, 176, 146];
const FRETS_SHOWN = 5;
/** Expected strings still silent this long into a take pulse amber. */
const SILENT_AFTER_S = 0.6;

const ZERO6 = new Float32Array(6);

function verdictColor(v: StringVerdict): [number, number, number] {
  if (v === "ok") return LISTEN_SAGE;
  if (v === "extra") return CORAL;
  if (v === "missing" || v === "unclear") return AMBER;
  return CREAM;
}

/**
 * Horizontal strings (high e on top, like tab) with a node at each fretted
 * position. Each string rings with the live energy of the pitch it should
 * make: sage when heard, amber pulse when expected but silent, coral flash for
 * an extra note, dashed when muted. Ref-driven: no React state at audio rate.
 * Reduced motion: no vibration and no rAF loop — static bars whose opacity
 * follows the energy, redrawn every 100 ms while listening.
 */
function ListenField({ className, targets, energyRef, extraRef, state, verdicts, label }: ListenProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef(state);
  const verdictsRef = useRef(verdicts ?? null);
  const kickRef = useRef<() => void>(() => {});
  const recSinceRef = useRef<number | null>(null);
  const targetsKey = targets.map((t) => `${t.string}:${t.midi ?? "x"}`).join(",");

  useEffect(() => {
    if (state === "recording" && stateRef.current !== "recording") recSinceRef.current = performance.now();
    if (state !== "recording") recSinceRef.current = null;
    stateRef.current = state;
    verdictsRef.current = verdicts ?? null;
    kickRef.current();
  }, [state, verdicts]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const governor = new FrameGovernor("StringField:listen");
    const probe = perfProbe(stateRef.current === "done" ? "listen-done" : "listen");
    const font = getComputedStyle(document.body).fontFamily || "sans-serif";

    const played = targets.filter((t) => t.fret !== null && t.fret > 0).map((t) => t.fret as number);
    const startFret = played.length && Math.max(...played) > FRETS_SHOWN ? Math.min(...played) : 1;

    let w = 0;
    let h = 0;
    let visible = true;
    let frame = 0;
    let interval: ReturnType<typeof setInterval> | null = null;
    let running = false;
    let last = performance.now();
    let time = 0;
    const amps = new Float32Array(6);
    const phases = Array.from({ length: 6 }, () => Math.random() * Math.PI * 2);

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = backingDpr(governor.quality.dpr, window.devicePixelRatio || 1, rect.width, rect.height);
      w = rect.width;
      h = rect.height;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const geometry = () => {
      const left = 30;
      const right = w - 10;
      const top = Math.max(14, h * 0.12);
      const bottom = h - Math.max(16, h * 0.14);
      const gap = (bottom - top) / 5;
      // String i (0 = low E) is drawn at the bottom, high e on top.
      const y = (i: number) => bottom - i * gap;
      const neck = (right - left) * 0.58;
      const fretX = (k: number) => left + (k / (FRETS_SHOWN + 0.4)) * neck;
      const nodeX = (fret: number) => (fret === 0 ? left + 4 : fretX(fret - startFret + 0.5));
      return { left, right, top, bottom, gap, y, fretX, nodeX };
    };

    const draw = (dt: number) => {
      time += dt;
      const g = geometry();
      const st = stateRef.current;
      const verd = st === "done" ? verdictsRef.current : null;
      const energy = st === "armed" || st === "recording" ? energyRef?.current ?? ZERO6 : ZERO6;
      const extra = st === "armed" || st === "recording" ? extraRef?.current ?? ZERO6 : ZERO6;
      const recFor = recSinceRef.current === null ? 0 : (performance.now() - recSinceRef.current) / 1000;
      const glow = governor.quality.glow;
      ctx.clearRect(0, 0, w, h);

      // Fret wires and nut
      ctx.lineWidth = 1;
      for (let k = 0; k <= FRETS_SHOWN; k++) {
        const x = g.fretX(k);
        ctx.strokeStyle = k === 0 && startFret === 1 ? "rgba(243,234,216,0.32)" : "rgba(243,234,216,0.08)";
        ctx.lineWidth = k === 0 && startFret === 1 ? 3 : 1;
        ctx.beginPath();
        ctx.moveTo(x, g.top - 8);
        ctx.lineTo(x, g.bottom + 8);
        ctx.stroke();
      }
      if (startFret > 1) {
        ctx.fillStyle = "rgba(243,234,216,0.45)";
        ctx.font = `600 10px ${font}`;
        ctx.fillText(`${startFret}fr`, g.fretX(0.15), g.bottom + 14);
      }

      const segs = Math.max(24, Math.round((g.right - g.left) / governor.quality.segDiv));
      const maxAmp = Math.min(18, g.gap * 0.42);
      const pulse = 0.55 + 0.45 * Math.sin(time * Math.PI * 2 * 1.2);
      let loudest = 0;

      for (let i = 0; i < 6; i++) {
        const t = targets[i];
        const e = Math.max(0, Math.min(1, energy[i] || 0));
        const x5 = Math.max(0, Math.min(1, extra[i] || 0));
        loudest = Math.max(loudest, e);
        const y0 = g.y(i);
        const thickness = 2.3 - (i / 5) * 1.4;

        // Colour and alpha for this string's state
        let rgb: [number, number, number] = CREAM;
        let alpha = 0.28;
        let dashed = false;
        let glowAlpha = 0;
        if (verd) {
          const v = verd[i];
          rgb = verdictColor(v);
          dashed = v === "muted";
          alpha = v === "muted" ? 0.2 : v === "unclear" ? 0.7 : 0.9;
          glowAlpha = v === "ok" || v === "missing" ? 0.2 : 0;
        } else if (t.muted) {
          dashed = true;
          alpha = 0.2;
        } else {
          rgb = mix(CREAM, LISTEN_SAGE, Math.min(1, e * 1.6)) as [number, number, number];
          alpha = 0.3 + 0.65 * Math.min(1, e * 1.4);
          glowAlpha = 0.35 * e;
          if (st === "recording" && recFor > SILENT_AFTER_S && e < 0.2) {
            rgb = AMBER;
            alpha = reduceMotion ? 0.8 : 0.45 + 0.45 * pulse;
            glowAlpha = reduceMotion ? 0.12 : 0.18 * pulse;
          }
        }
        if (x5 > 0.04) {
          rgb = mix(rgb, CORAL, x5) as [number, number, number];
          alpha = Math.max(alpha, 0.5 + 0.5 * x5);
          glowAlpha = Math.max(glowAlpha, 0.3 * x5);
          dashed = false;
        }

        // Vibration (none under reduced motion)
        if (!reduceMotion) {
          amps[i] = Math.max(amps[i] * Math.pow(0.2, dt), e * maxAmp, x5 * maxAmp * 0.5);
        } else amps[i] = 0;
        const freq = 15 + i * 2.6;
        const pts: [number, number][] = [];
        if (amps[i] > 0.05) {
          for (let k = 0; k <= segs; k++) {
            const u = k / segs;
            const x = g.left + u * (g.right - g.left);
            pts.push([x, y0 + amps[i] * Math.sin(Math.PI * u) * Math.sin(time * freq + phases[i])]);
          }
        } else {
          pts.push([g.left, y0], [g.right, y0]);
        }
        const stroke = (width: number, a: number) => {
          ctx.strokeStyle = `rgba(${rgb.join(",")},${a})`;
          ctx.lineWidth = width;
          ctx.beginPath();
          pts.forEach(([x, y], k) => (k === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
          ctx.stroke();
        };
        if (dashed) ctx.setLineDash([4, 5]);
        if (glow && glowAlpha > 0.01) stroke(thickness * 6, glowAlpha);
        stroke(thickness, alpha);
        if (dashed) ctx.setLineDash([]);

        // Fret node / open-string ring
        if (!t.muted && t.fret !== null) {
          const nx = g.nodeX(t.fret);
          ctx.fillStyle = `rgba(${rgb.join(",")},${Math.min(1, alpha + 0.1)})`;
          ctx.strokeStyle = ctx.fillStyle;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(nx, y0, t.fret === 0 ? 4 : 5.5, 0, Math.PI * 2);
          if (t.fret === 0) ctx.stroke();
          else ctx.fill();
        }

        // Label: the note this string should make, × when muted
        ctx.font = `600 11px ${font}`;
        ctx.textBaseline = "middle";
        ctx.fillStyle = `rgba(${rgb.join(",")},${t.muted && !verd ? 0.45 : Math.max(0.55, alpha)})`;
        ctx.fillText(t.muted ? "×" : t.note ?? "", 6, y0);
      }

      // Level baseline: a 2 px glow along the bottom while listening.
      if (st === "armed" || st === "recording") {
        ctx.fillStyle = `rgba(${LISTEN_SAGE.join(",")},${0.12 + 0.6 * loudest})`;
        ctx.fillRect(g.left, h - 3, (g.right - g.left) * (0.25 + 0.75 * loudest), 2);
      }
    };

    const listening = () => stateRef.current === "armed" || stateRef.current === "recording";
    const settled = () => !listening() && amps.every((a) => a < 0.05);

    const tick = (now: number) => {
      const dtMs = Math.max(0, now - last);
      last = now;
      if (dtMs > 0) {
        probe?.sample(dtMs, governor.tier);
        if (governor.sample(dtMs)) resize();
      }
      draw(Math.min(dtMs / 1000, 0.05));
      if (settled()) {
        running = false;
        return;
      }
      frame = requestAnimationFrame(tick);
    };

    const start = () => {
      if (!visible || document.hidden) return;
      if (reduceMotion) {
        draw(0);
        if (listening() && !interval) interval = setInterval(() => draw(0.1), 100);
        if (!listening() && interval) {
          clearInterval(interval);
          interval = null;
        }
        return;
      }
      if (running) return;
      running = true;
      last = performance.now();
      frame = requestAnimationFrame(tick);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(frame);
      if (interval) clearInterval(interval);
      interval = null;
    };
    kickRef.current = () => {
      if (!running) draw(0);
      start();
    };

    resize();
    draw(0);
    const ro = new ResizeObserver(() => {
      resize();
      draw(0);
    });
    ro.observe(canvas);
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) start();
      else stop();
    });
    io.observe(canvas);
    const onVisibility = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVisibility);
    start();

    return () => {
      stop();
      kickRef.current = () => {};
      probe?.dispose();
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
    // targets are keyed by content; refs are stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetsKey]);

  return <canvas ref={canvasRef} className={className} role="img" aria-label={label ?? "Strings listening view"} />;
}
