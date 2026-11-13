"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import RoomScene, { type RoomState } from "./RoomScene";
import { ROOM_OBJECTS, SCENE_H, SCENE_W, type RoomObject, type RoomObjectId } from "./roomObjects";
import { pluck } from "@/lib/sound";

interface Props {
  state?: RoomState;
  /** Per-object overrides, e.g. a badge on the record player ("3 due"). */
  badges?: Partial<Record<RoomObjectId, string>>;
  /** Objects to leave out (e.g. the tuner on a teacher's hub). */
  hide?: RoomObjectId[];
  /** Per-object link overrides (e.g. the amp opens your next chord). */
  hrefs?: Partial<Record<RoomObjectId, string>>;
  /** Per-object blurb overrides shown in the caption and list. */
  blurbs?: Partial<Record<RoomObjectId, string>>;
  /** Show the "In this room" list under the scene (always on phones). */
  showIndex?: boolean;
  className?: string;
}

const pct = (v: number, of: number) => `${(v / of) * 100}%`;

/**
 * The interactive practice room. The scene is decorative SVG; every object is
 * also a real link positioned over it, so keyboard, screen readers and touch
 * all work. On phones the room is a horizontal panorama you can swipe.
 */
export default function Room({ state, badges = {}, hide = [], hrefs = {}, blurbs = {}, showIndex = true, className = "" }: Props) {
  const [active, setActive] = useState<RoomObjectId | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const pan = useRef<HTMLDivElement>(null);
  const objects = ROOM_OBJECTS.filter((o) => !hide.includes(o.id)).map((o) => ({
    ...o,
    href: hrefs[o.id] ?? o.href,
    blurb: blurbs[o.id] ?? o.blurb,
  }));

  // pointer parallax (desktop) — writes CSS vars, no React re-render per move
  const onMove = useCallback((e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    const el = wrap.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", (((e.clientX - r.left) / r.width) * 2 - 1).toFixed(3));
    el.style.setProperty("--my", (((e.clientY - r.top) / r.height) * 2 - 1).toFixed(3));
  }, []);
  const onLeave = useCallback(() => {
    wrap.current?.style.setProperty("--mx", "0");
    wrap.current?.style.setProperty("--my", "0");
    setActive(null);
  }, []);

  // phones: start the panorama centred on the guitar
  useEffect(() => {
    const el = pan.current;
    if (el && el.scrollWidth > el.clientWidth) {
      el.scrollLeft = el.scrollWidth * (817 / SCENE_W) - el.clientWidth / 2;
    }
  }, []);

  const enter = (o: RoomObject) => {
    if (active !== o.id) pluck(o.hz);
    setActive(o.id);
  };

  return (
    <div className={className}>
      <div
        ref={wrap}
        onPointerMove={onMove}
        onPointerLeave={onLeave}
        className="os-room-frame relative overflow-hidden rounded-[28px] border border-cream/10 bg-ink-950 shadow-[0_40px_120px_-40px_rgba(232,165,75,0.25)]"
      >
        {/* panorama: fixed height on phones, full width on desktop */}
        <div ref={pan} className="os-room-pan overflow-x-auto overflow-y-hidden md:overflow-hidden" tabIndex={-1}>
          <div className="relative h-[380px] w-[675px] sm:h-[460px] sm:w-[818px] md:h-auto md:w-full md:aspect-[16/9]">
            <RoomScene active={active} state={state} />
            {objects.map((o) => (
              <Link
                key={o.id}
                href={o.href}
                onPointerEnter={(e) => e.pointerType === "mouse" && enter(o)}
                onFocus={() => enter(o)}
                onBlur={() => setActive((a) => (a === o.id ? null : a))}
                className="group absolute rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-amber-300/80"
                style={{ left: pct(o.x, SCENE_W), top: pct(o.y, SCENE_H), width: pct(o.w, SCENE_W), height: pct(o.h, SCENE_H) }}
                aria-label={`${o.label} — ${o.blurb}`}
              >
                {/* phones: a pulsing dot invites a tap (the list below names everything) */}
                <span className="pointer-events-none absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-300 shadow-[0_0_0_6px_rgba(232,165,75,0.25)] os-hotspot md:hidden" />
                <span
                  className={`pointer-events-none absolute left-1/2 hidden -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-full border px-3 py-1 label-mono transition-all duration-base ease-out-expo md:block ${
                    active === o.id
                      ? "border-amber-300/60 bg-ink-950/90 text-amber-200 opacity-100"
                      : "border-cream/15 bg-ink-950/70 text-cream/70 opacity-0 translate-y-[-80%]"
                  }`}
                  style={{ top: `${((o.tag[1] - o.y) / o.h) * 100}%` }}
                >
                  {o.label}
                  {badges[o.id] && <span className="ml-2 rounded-full bg-amp-500 px-1.5 text-[10px] text-cream">{badges[o.id]}</span>}
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* desktop caption for the hovered object */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 hidden md:block">
          <div
            className={`mx-6 mb-6 max-w-md rounded-2xl border border-cream/10 bg-ink-950/80 p-4 backdrop-blur transition-all duration-base ease-out-expo ${
              active ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
            }`}
            aria-hidden="true"
          >
            {active && (() => {
              const o = objects.find((x) => x.id === active) ?? ROOM_OBJECTS.find((x) => x.id === active)!;
              return (
                <>
                  <p className="label-mono text-amber-300">{o.thing}</p>
                  <p className="mt-1 font-display text-xl uppercase text-cream">{o.label}</p>
                  <p className="mt-1 text-sm text-cream/70">{o.blurb}</p>
                </>
              );
            })()}
          </div>
        </div>
        <p className="label-mono pointer-events-none absolute right-4 top-4 hidden text-cream/40 md:block">Hover the room · click to enter</p>
        <p className="label-mono pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap text-cream/50 md:hidden">← swipe · tap a light →</p>
      </div>

      {showIndex && (
        <nav aria-label="In this room" className="mt-6">
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {objects.map((o) => (
              <li key={o.id}>
                <Link
                  href={o.href}
                  onPointerEnter={(e) => e.pointerType === "mouse" && enter(o)}
                  onPointerLeave={() => setActive(null)}
                  className={`flex items-start gap-3 rounded-2xl border p-4 transition-colors duration-fast ${
                    active === o.id ? "border-amber-400/50 bg-amber-400/[0.06]" : "border-cream/10 hover:border-cream/25"
                  }`}
                >
                  <span className="label-mono mt-0.5 w-24 shrink-0 text-cream/50">{o.thing}</span>
                  <span>
                    <span className="block font-semibold text-cream">
                      {o.label}
                      {badges[o.id] && <span className="ml-2 rounded-full bg-amp-500 px-1.5 text-[11px] text-cream">{badges[o.id]}</span>}
                    </span>
                    <span className="block text-sm text-cream/60">{o.blurb}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}
