"use client";

import { useEffect, useRef } from "react";

interface Props {
  className?: string;
  /** "hero": bright, strums itself, reacts to the pointer. "ambient": dim backdrop. */
  variant?: "hero" | "ambient";
}

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
export default function StringField({ className, variant = "hero" }: Props) {
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

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
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

      const segs = Math.max(60, Math.round(w / 9));
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
        for (const [width, alpha] of [
          [thickness * 7, (0.05 + energy * 0.12) * dim],
          [thickness, (0.45 + energy * 0.45) * dim],
        ] as const) {
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
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
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
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pointermove", onMove);
    };
  }, [variant]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
