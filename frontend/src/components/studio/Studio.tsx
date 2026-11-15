"use client";

/**
 * The app's home: the 2.5D practice room, full screen.
 * Drag to look around the room (its layers shift with depth as you pan);
 * tap an object and the view glides and zooms to it, with a card that opens
 * its feature. Swipe while zoomed to move to the next object; back returns.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import RoomScene from "@/components/room/RoomScene";
import { ROOM_OBJECTS, SCENE_H, SCENE_W, type RoomObject, type RoomObjectId } from "@/components/room/roomObjects";
import { useAuth } from "@/context/AuthContext";
import { getPlan, getProgress, type PlanItem } from "@/lib/api";
import { planTitle } from "@/lib/mastery";
import { planHref } from "@/app/dashboard/_components/TodaysPlan";
import { pluck } from "@/lib/sound";

/** Left-to-right order through the room. */
const ORDER: RoomObjectId[] = ["wall", "amp", "pedal", "guitar", "stand", "record", "metronome"];
const OBJECTS = ORDER.map((id) => ROOM_OBJECTS.find((o) => o.id === id)!);

interface View {
  tx: number;
  ty: number;
  z: number;
}

function useViewport() {
  const [vp, setVp] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const on = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return vp;
}

export default function Studio() {
  const router = useRouter();
  const { user } = useAuth();
  const swrOpts = { revalidateOnFocus: false };
  const { data: progress } = useSWR(user ? "/api/progress" : null, getProgress, swrOpts);
  const { data: plan } = useSWR(user ? "/api/plan/next" : null, getPlan, swrOpts);
  const next: PlanItem | undefined = plan?.items?.[0];
  const due = plan?.items?.filter((i) => i.type === "review").length ?? 0;

  const vp = useViewport();
  // the room takes ~2/3 of a tall screen (wider than it, so you pan through it);
  // on wide screens it fits the width
  const s = vp.h ? Math.max((vp.h * 0.66) / SCENE_H, Math.min(vp.w / SCENE_W, (vp.h * 0.9) / SCENE_H)) : 1;
  const SW = SCENE_W * s, SH = SCENE_H * s;

  const [focus, setFocus] = useState<RoomObjectId | null>(null);
  const [view, setView] = useState<View>({ tx: 0, ty: 0, z: 1 });
  const [dragging, setDragging] = useState(false);
  const overviewTx = useRef<number | null>(null);

  // keep the room covering the screen horizontally; vertically, keep it covering when it's
  // taller than the screen, otherwise keep it fully on screen
  const clamp = useCallback(
    (v: View): View => {
      const w = SW * v.z, h = SH * v.z;
      const tx = w > vp.w ? Math.min(0, Math.max(vp.w - w, v.tx)) : (vp.w - w) / 2;
      const ty = h > vp.h ? Math.min(0, Math.max(vp.h - h, v.ty)) : Math.max(0, Math.min(vp.h - h, v.ty));
      return { z: v.z, tx, ty };
    },
    [vp.w, vp.h, SW, SH],
  );
  /** The room view sits a little above centre, between the HUD and the bottom button. */
  const roomTy = (vp.h - SH) * 0.42;

  /** Zoom so the object fills the space above the card, centred there. */
  const viewFor = useCallback(
    (o: RoomObject): View => {
      const z = Math.max(1, Math.min(3.2, (vp.w * 0.78) / (o.w * s), (vp.h * 0.46) / (o.h * s)));
      const cx = (o.x + o.w / 2) * s, cy = (o.y + o.h / 2) * s;
      return clamp({ z, tx: vp.w / 2 - cx * z, ty: vp.h * 0.33 - cy * z });
    },
    [vp.w, vp.h, s, clamp],
  );

  // start centred on the guitar, like walking into the room
  useEffect(() => {
    if (!vp.w) return;
    if (overviewTx.current === null) {
      const g = ROOM_OBJECTS.find((o) => o.id === "guitar")!;
      overviewTx.current = vp.w / 2 - (g.x + g.w / 2) * s;
    }
    setView(focus ? viewFor(ROOM_OBJECTS.find((o) => o.id === focus)!) : clamp({ tx: overviewTx.current, ty: roomTy, z: 1 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vp.w, vp.h, focus]);

  // Android back / browser back: zoomed in -> back to the room first
  const select = useCallback((id: RoomObjectId | null) => {
    setFocus((cur) => {
      if (id && !cur) window.history.pushState({ studioFocus: true }, "");
      if (!id && cur && window.history.state?.studioFocus) window.history.back();
      return id;
    });
    if (id) {
      const o = ROOM_OBJECTS.find((x) => x.id === id)!;
      pluck(o.hz);
      import("@capacitor/haptics").then(({ Haptics, ImpactStyle }) => Haptics.impact({ style: ImpactStyle.Light })).catch(() => {});
    }
  }, []);
  useEffect(() => {
    const onPop = () => setFocus(null);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // drag to pan (room view); swipe to step (zoomed view)
  const drag = useRef<{ x: number; y: number; tx: number; moved: boolean; t: number } | null>(null);
  // the click after a drag must not open the object under the finger
  const lastWasDrag = useRef(false);
  const onPointerDown = (e: React.PointerEvent) => {
    lastWasDrag.current = false;
    drag.current = { x: e.clientX, y: e.clientY, tx: view.tx, moved: false, t: performance.now() };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    if (Math.abs(dx) > 6) d.moved = true;
    if (!focus && d.moved) {
      setDragging(true);
      const v = clamp({ tx: d.tx + dx, ty: roomTy, z: 1 });
      overviewTx.current = v.tx;
      setView(v);
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    setDragging(false);
    lastWasDrag.current = !!d?.moved;
    if (!d || !focus) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.3 || performance.now() - d.t > 700) return;
    const i = ORDER.indexOf(focus);
    select(ORDER[(i + (dx < 0 ? 1 : -1) + ORDER.length) % ORDER.length]);
  };
  const wasDrag = () => lastWasDrag.current;

  function hrefFor(id: RoomObjectId): string {
    switch (id) {
      case "guitar":
        return next ? planHref(next) : "/start";
      case "amp":
        return "/practice";
      case "pedal":
        return "/tuner";
      case "stand":
        return "/songs";
      case "record":
        return "/practice?mode=song";
      case "metronome":
        return "/practice?mode=transitions";
      case "wall":
        return user ? "/progress" : "/login?next=/progress";
    }
  }

  const station = focus ? ROOM_OBJECTS.find((o) => o.id === focus)! : null;
  const mastered = progress?.mastered_count ?? 0;
  const streak = progress?.practice_streak ?? 0;
  // parallax: the room's depth layers shift as you look left / right
  const span = SW * view.z - vp.w;
  const mx = span > 0 ? ((0.5 + view.tx / span) * 2).toFixed(3) : "0";
  const sheet = useMemo<[string, string]>(() => {
    const syms = (plan?.items ?? []).filter((i) => i.chord_symbol).map((i) => i.chord_symbol!).slice(0, 4);
    const bar = (a?: string, b?: string) => (a ? `| ${a} . | ${b ?? a} . |` : "| G . | D . |");
    return [bar(syms[0], syms[1]), bar(syms[2] ?? syms[0], syms[3] ?? syms[1])];
  }, [plan]);

  return (
    <div
      className="fixed inset-0 select-none overflow-hidden bg-ink-950 touch-none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => ((drag.current = null), setDragging(false))}
      data-testid="studio"
    >
      {vp.w > 0 && (
        <div
          className="absolute left-0 top-0 origin-top-left will-change-transform"
          style={{
            width: SW,
            height: SH,
            transform: `translate3d(${view.tx}px, ${view.ty}px, 0) scale(${view.z})`,
            transition: dragging ? "none" : "transform 650ms cubic-bezier(0.16, 1, 0.3, 1)",
            ["--mx" as string]: mx,
            ["--my" as string]: focus ? "0.25" : "0",
          }}
        >
          <div
            className="pointer-events-none absolute inset-x-0 -top-px z-10 h-[14%]"
            style={{ background: "linear-gradient(to bottom, #0c0a09, transparent)" }}
          />
          <div
            className="pointer-events-none absolute inset-x-0 -bottom-px z-10 h-[16%]"
            style={{ background: "linear-gradient(to top, #0c0a09, transparent)" }}
          />
          <RoomScene
            active={focus}
            state={{ mastered, streak, sheet, recheckDue: due > 0 }}
          />
          {/* tap targets over each object */}
          {OBJECTS.map((o) => (
            <button
              key={o.id}
              type="button"
              aria-label={`${o.thing}: ${o.label}`}
              onClick={() => {
                if (wasDrag()) return;
                if (focus === o.id) router.push(hrefFor(o.id));
                else select(o.id);
              }}
              className="absolute rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-amber-300/80"
              style={{ left: o.x * s, top: o.y * s, width: o.w * s, height: o.h * s }}
            >
              {!focus && (
                <span className="pointer-events-none absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-300 os-hotspot" />
              )}
              {!focus && (o.id === "wall" ? due > 0 : o.id === "guitar" && !!next) && (
                <span className="pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-amp-500 px-2 py-0.5 text-[11px] font-semibold text-cream">
                  {o.id === "wall" ? `${due} re-check${due > 1 ? "s" : ""}` : "Lesson ready"}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* soft vignette, darker at the bottom for the card */}
      <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(130% 80% at 50% 40%, transparent 55%, rgba(0,0,0,0.6) 100%), linear-gradient(to bottom, rgba(12,10,9,0.55), transparent 18%, transparent 62%, rgba(12,10,9,0.85))" }} />

      {/* HUD */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => router.push(user ? "/profile" : "/login")}
          className="pointer-events-auto flex items-center gap-2 rounded-full border border-cream/10 bg-ink-950/70 py-1.5 pl-1.5 pr-3 backdrop-blur"
          aria-label={user ? "Your profile" : "Sign in"}
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-400 text-sm font-bold text-ink-950">
            {(user?.display_name ?? "?").slice(0, 1).toUpperCase()}
          </span>
          <span className="text-sm text-cream">{user ? user.display_name : "Sign in"}</span>
        </button>
        <div className="flex gap-2">
          <Chip label="Streak" value={`${streak}🔥`} />
          <Chip label="Gold" value={`${mastered}`} />
        </div>
      </div>

      {/* room view: next step + hint */}
      {!station && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-center">
          {next && (
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => router.push(planHref(next))}
              className="pointer-events-auto mb-4 inline-flex max-w-full items-center gap-3 rounded-full bg-amber-400 px-5 py-3 font-semibold text-ink-950 shadow-lg shadow-amber-400/20"
            >
              <span className="label-mono text-ink-950/60">Next up</span>
              <span className="truncate">{planTitle(next)}</span> →
            </button>
          )}
          <p className="label-mono text-cream/50">Drag to look around · tap a light</p>
        </div>
      )}

      {/* zoomed in: the object's card */}
      {station && (
        <div
          className="absolute inset-x-0 bottom-0 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
        >
          <div key={station.id} className="animate-enter-fast rounded-[26px] border border-cream/10 bg-ink-950/90 p-5 shadow-2xl backdrop-blur-md">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="label-mono text-amber-400">{station.thing}</p>
                <h2 className="mt-1 font-display text-2xl uppercase text-cream">{station.id === "guitar" ? (next ? "Today's lesson" : "Start here") : station.label}</h2>
              </div>
              <button onClick={() => select(null)} aria-label="Back to the room" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-cream/15 text-cream/70">
                ✕
              </button>
            </div>
            <p className="mt-2 text-[15px] leading-snug text-cream/70">
              {station.id === "guitar" && next ? `Up next: ${planTitle(next)}.` : station.blurb}
            </p>
            <div className="mt-4 flex items-center gap-3">
              <button onClick={() => router.push(hrefFor(station.id))} className="h-12 flex-1 rounded-full bg-amber-400 text-base font-semibold text-ink-950 active:scale-[0.98]">
                Enter →
              </button>
              <div className="flex items-center gap-1.5" role="tablist" aria-label="Objects in the room">
                {ORDER.map((id) => (
                  <button
                    key={id}
                    role="tab"
                    aria-selected={id === station.id}
                    aria-label={ROOM_OBJECTS.find((o) => o.id === id)!.thing}
                    onClick={() => select(id)}
                    className={`h-2 rounded-full transition-all ${id === station.id ? "w-5 bg-amber-400" : "w-2 bg-cream/25"}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-full border border-cream/10 bg-ink-950/70 px-3 py-1.5 backdrop-blur" aria-label={`${label}: ${value}`}>
      <span className="label-mono text-cream/50">{label} </span>
      <span className="font-semibold text-cream">{value}</span>
    </div>
  );
}
