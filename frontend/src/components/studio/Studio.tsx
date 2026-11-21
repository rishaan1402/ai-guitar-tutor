"use client";

/**
 * The app's home: the 2.5D practice room, full screen (landscape).
 * A guitar pick is your cursor: drag it around the room and whatever it
 * points at lights up and says what it is; let go (or tap) and the view
 * glides in to that object with a card that opens its feature. Near the
 * edges the room pans with the pick. Swipe while zoomed to step to the next
 * object; back returns.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import RoomScene from "@/components/room/RoomScene";
import LevelUp from "@/components/game/LevelUp";
import { ROOM_OBJECTS, SCENE_H, SCENE_W, type RoomObject, type RoomObjectId } from "@/components/room/roomObjects";
import { useAuth } from "@/context/AuthContext";
import { getGame, getPlan, getProgress, type PlanItem } from "@/lib/api";
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
  const { data: game } = useSWR(user ? "/api/game" : null, getGame, swrOpts);
  const next: PlanItem | undefined = plan?.items?.[0];
  const [levelUp, setLevelUp] = useState<{ level: number; title: string; unlock: string | null } | null>(null);
  useEffect(() => {
    if (!game) return;
    let last = 0;
    try {
      last = Number(localStorage.getItem("os:last-level")) || 0;
      localStorage.setItem("os:last-level", String(game.level));
    } catch {
      /* storage blocked: no celebration, nothing breaks */
    }
    if (last > 0 && game.level > last) {
      const unlock = game.upgrades.find((u) => u.level === game.level)?.label ?? null;
      setLevelUp({ level: game.level, title: game.title, unlock });
    }
  }, [game]);
  const due = plan?.items?.filter((i) => i.type === "review").length ?? 0;

  const vp = useViewport();
  const wide = vp.w > vp.h;
  // landscape: the room covers the screen with a little to spare, so the pick can pan it;
  // portrait (web only): it takes ~2/3 of the height and you pan through it
  const s = !vp.h
    ? 1
    : wide
      ? // landscape: the whole room fits on screen, no zoom; extra width fades to the background
        Math.min(vp.w / SCENE_W, vp.h / SCENE_H)
      : Math.max((vp.h * 0.66) / SCENE_H, Math.min(vp.w / SCENE_W, (vp.h * 0.9) / SCENE_H));
  const SW = SCENE_W * s, SH = SCENE_H * s;
  /** Landscape card width: a side panel on the right. */
  const cardW = wide ? Math.min(380, vp.w * 0.42) : 0;

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
  const roomTy = (vp.h - SH) * (wide ? 0.5 : 0.42);

  /** Zoom so the object fills the space above the card, centred there. */
  const viewFor = useCallback(
    (o: RoomObject): View => {
      const cx = (o.x + o.w / 2) * s, cy = (o.y + o.h / 2) * s;
      if (wide) {
        // the object fills the space left of the side card
        const room = vp.w - cardW - 24;
        const z = Math.max(1, Math.min(3.2, (room * 0.8) / (o.w * s), (vp.h * 0.62) / (o.h * s)));
        return clamp({ z, tx: room / 2 - cx * z, ty: vp.h * 0.54 - cy * z });
      }
      const z = Math.max(1, Math.min(3.2, (vp.w * 0.78) / (o.w * s), (vp.h * 0.46) / (o.h * s)));
      return clamp({ z, tx: vp.w / 2 - cx * z, ty: vp.h * 0.33 - cy * z });
    },
    [vp.w, vp.h, s, clamp, wide, cardW],
  );

  const overviewTy = useRef<number | null>(null);
  // start centred on the guitar, like walking into the room
  useEffect(() => {
    if (!vp.w) return;
    if (overviewTx.current === null) {
      const g = ROOM_OBJECTS.find((o) => o.id === "guitar")!;
      overviewTx.current = vp.w / 2 - (g.x + g.w / 2) * s;
    }
    setView(
      focus
        ? viewFor(ROOM_OBJECTS.find((o) => o.id === focus)!)
        : clamp({ tx: overviewTx.current, ty: overviewTy.current ?? roomTy, z: 1 }),
    );
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

  // ── the pick ────────────────────────────────────────────────
  // Its tip (screen px) is the cursor. Touch: it rides a little above the finger so
  // you can see what it points at. The room pans when it nears an edge.
  const [pick, setPick] = useState<{ x: number; y: number } | null>(null);
  const [hover, setHover] = useState<RoomObjectId | null>(null);
  const viewRef = useRef(view);
  viewRef.current = view;
  const drag = useRef<{ x: number; y: number; moved: boolean; t: number; lift: number } | null>(null);
  const tipRef = useRef<{ x: number; y: number } | null>(null);

  /** The object under a screen point in the room view. */
  const objectAt = useCallback(
    (x: number, y: number): RoomObjectId | null => {
      const v = viewRef.current;
      const sx = (x - v.tx) / (v.z * s), sy = (y - v.ty) / (v.z * s);
      // smallest object first, so the pedal wins over the wall behind it
      const hits = OBJECTS.filter((o) => sx >= o.x && sx <= o.x + o.w && sy >= o.y && sy <= o.y + o.h);
      hits.sort((a, b) => a.w * a.h - b.w * b.h);
      return hits[0]?.id ?? null;
    },
    [s],
  );

  const aim = useCallback(
    (x: number, y: number) => {
      tipRef.current = { x, y };
      setPick({ x, y });
      const id = objectAt(x, y);
      setHover((cur) => {
        if (id && id !== cur) {
          pluck(ROOM_OBJECTS.find((o) => o.id === id)!.hz, 0.1);
          import("@capacitor/haptics").then(({ Haptics }) => Haptics.selectionChanged()).catch(() => {});
        }
        return id;
      });
    },
    [objectAt],
  );

  // edge auto-pan while the pick is held
  useEffect(() => {
    if (focus || !dragging) return;
    let raf = 0;
    const loop = () => {
      const t = tipRef.current;
      if (t && vp.w) {
        const edge = Math.min(90, vp.w * 0.12), edgeY = Math.min(70, vp.h * 0.15);
        const push = (p: number, size: number, e: number) => (p < e ? (e - p) / e : p > size - e ? -(p - (size - e)) / e : 0);
        const dx = push(t.x, vp.w, edge) * 9, dy = push(t.y, vp.h, edgeY) * 6;
        if (dx || dy) {
          const cur = viewRef.current;
          const v = clamp({ tx: cur.tx + dx, ty: cur.ty + dy, z: 1 });
          if (v.tx !== cur.tx || v.ty !== cur.ty) {
            overviewTx.current = v.tx;
            overviewTy.current = v.ty;
            viewRef.current = v;
            setView(v);
            aim(t.x, t.y);
          }
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [focus, dragging, vp.w, vp.h, clamp, aim]);

  const onPointerDown = (e: React.PointerEvent) => {
    const lift = e.pointerType === "mouse" ? 0 : 44;
    drag.current = { x: e.clientX, y: e.clientY, moved: false, t: performance.now(), lift };
    if (!focus) {
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      setDragging(true);
      aim(e.clientX, e.clientY - lift);
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) {
      // a mouse just hovering moves the pick too
      if (!focus && e.pointerType === "mouse") aim(e.clientX, e.clientY);
      return;
    }
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8) d.moved = true;
    if (!focus) aim(e.clientX, e.clientY - d.lift);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    setDragging(false);
    if (!d) return;
    if (!focus) {
      // a tap picks what's under the finger; a drag picks what the pick points at
      const id = d.moved ? hover : objectAt(e.clientX, e.clientY) ?? hover;
      if (id) {
        setHover(null);
        select(id);
      }
      return;
    }
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (!d.moved) {
      // zoomed in: tap the object to go in, or a neighbour to move to it
      const id = objectAt(e.clientX, e.clientY);
      if (id === focus) router.push(hrefFor(focus));
      else if (id) select(id);
      return;
    }
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.3 || performance.now() - d.t > 700) return;
    const i = ORDER.indexOf(focus);
    select(ORDER[(i + (dx < 0 ? 1 : -1) + ORDER.length) % ORDER.length]);
  };
  // start with the pick resting by the guitar
  useEffect(() => {
    if (vp.w && !pick) setPick({ x: vp.w * 0.5, y: vp.h * 0.62 });
  }, [vp.w, vp.h, pick]);

  function hrefFor(id: RoomObjectId): string {
    switch (id) {
      case "guitar":
        return "/path";
      case "amp":
        return "/practice";
      case "pedal":
        return "/tuner";
      case "stand":
        return "/songs";
      case "record":
        return "/practice?mode=song";
      case "metronome":
        return "/groove";
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
      className="os-force-dark fixed inset-0 select-none overflow-hidden bg-ink-950 text-cream touch-none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => ((drag.current = null), setDragging(false))}
      onPointerLeave={(e) => e.pointerType === "mouse" && !drag.current && setHover(null)}
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
            style={{ background: "linear-gradient(to bottom, rgb(var(--ink-950)), transparent)" }}
          />
          <div
            className="pointer-events-none absolute inset-x-0 -bottom-px z-10 h-[16%]"
            style={{ background: "linear-gradient(to top, rgb(var(--ink-950)), transparent)" }}
          />
          {/* on screens wider than the room, its side walls fade into the background */}
          {SW * view.z < vp.w - 2 && (
            <>
              <div className="pointer-events-none absolute inset-y-0 -left-px z-10 w-[7%]" style={{ background: "linear-gradient(to right, rgb(var(--ink-950)), transparent)" }} />
              <div className="pointer-events-none absolute inset-y-0 -right-px z-10 w-[7%]" style={{ background: "linear-gradient(to left, rgb(var(--ink-950)), transparent)" }} />
            </>
          )}
          <RoomScene
            active={focus ?? hover}
            state={{ mastered, streak, sheet, recheckDue: due > 0, upgrades: game?.upgrades.filter((u) => u.unlocked).map((u) => u.id) }}
          />
          {/* keyboard / screen-reader targets over each object (the pick handles pointers) */}
          {OBJECTS.map((o) => (
            <button
              key={o.id}
              type="button"
              aria-label={`${o.thing}: ${o.label}`}
              onClick={(e) => {
                // pointer taps are handled by the pick; this is for Enter / Space
                if (e.detail !== 0) return;
                if (focus === o.id) router.push(hrefFor(o.id));
                else select(o.id);
              }}
              className={`absolute rounded-2xl outline-none transition-[box-shadow] duration-150 focus-visible:ring-2 focus-visible:ring-amber-300/80 ${
                hover === o.id && !focus ? "shadow-[0_0_0_2px_rgba(var(--accent-rgb),0.55),0_0_40px_rgba(var(--accent-rgb),0.25)]" : ""
              }`}
              style={{ left: o.x * s, top: o.y * s, width: o.w * s, height: o.h * s }}
            >
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
      <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(130% 80% at 50% 40%, transparent 55%, rgba(0,0,0,0.6) 100%), linear-gradient(to bottom, rgba(11,10,26,0.55), transparent 18%, transparent 62%, rgba(11,10,26,0.85))" }} />

      {/* what the pick points at */}
      {!focus && hover && (() => {
        const o = ROOM_OBJECTS.find((x) => x.id === hover)!;
        const left = view.tx + (o.x + o.w / 2) * s * view.z;
        const top = Math.max(64, view.ty + o.y * s * view.z - 12);
        return (
          <div className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full" style={{ left: Math.min(vp.w - 110, Math.max(110, left)), top }}>
            <div className="animate-enter-fast whitespace-nowrap rounded-2xl border border-amber-400/50 bg-ink-950/90 px-4 py-2 text-center shadow-xl backdrop-blur">
              <p className="label-mono text-[10px] text-amber-400">{o.thing}</p>
              <p className="font-display text-base uppercase leading-tight text-cream">{labelFor(o)}</p>
            </div>
          </div>
        );
      })()}
      {!focus && pick && (
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute z-30 drop-shadow-[0_4px_10px_rgba(0,0,0,0.6)]"
          style={{ left: pick.x - 17, top: pick.y - 44, transition: dragging ? "none" : "left 200ms, top 200ms" }}
          width="34"
          height="46"
          viewBox="0 0 34 46"
        >
          {/* a neon pick, point down: its tip is the cursor; it lights up over something you can open */}
          <defs>
            <linearGradient id="os-pick" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor={hover ? "#ff7fb5" : "#b494ff"} />
              <stop offset="0.55" stopColor={hover ? "#ff3d8b" : "#8a5cff"} />
              <stop offset="1" stopColor={hover ? "#8a5cff" : "#2ee6d6"} />
            </linearGradient>
          </defs>
          <path d="M17 45 C 9 36, 1 24, 1 13 C 1 5, 8 1, 17 1 C 26 1, 33 5, 33 13 C 33 24, 25 36, 17 45 Z" fill="url(#os-pick)" stroke="rgb(var(--ink-950))" strokeWidth="2" style={{ filter: hover ? "drop-shadow(0 0 10px rgba(255,61,139,0.9))" : "drop-shadow(0 0 6px rgba(138,92,255,0.7))" }} />
          <path d="M8 10 C 11 6, 23 6, 26 10" fill="none" stroke="rgba(var(--cream-rgb),0.45)" strokeWidth="2" strokeLinecap="round" />
          <circle cx="17" cy="45" r="2" fill="rgb(var(--ink-950))" opacity="0.6" />
        </svg>
      )}

      {levelUp && <LevelUp level={levelUp.level} title={levelUp.title} unlock={levelUp.unlock} onClose={() => setLevelUp(null)} />}

      {/* HUD */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4 pl-[max(1rem,var(--sa-l))] pr-[max(1rem,var(--sa-r))] pt-[max(1rem,var(--sa-t))]">
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
          {game && <DailyRing done={game.daily.done} total={game.daily.total} tasks={game.daily.tasks} />}
          <Chip label="Streak" spoken={`${streak} day${streak === 1 ? "" : "s"}`} value={<>{streak}<span className={streak > 0 ? "os-flame ml-0.5" : "ml-0.5 grayscale"} aria-hidden="true">🔥</span></>} />
        </div>
      </div>
      {/* level + XP, and the coach */}
      <div className="pointer-events-none absolute inset-x-0 top-[calc(max(1rem,var(--sa-t))+3rem)] flex items-start justify-between gap-3 pl-[max(1rem,var(--sa-l))] pr-[max(1rem,var(--sa-r))]">
        {game ? (
          <div className="pointer-events-auto w-44 rounded-2xl border border-cream/10 bg-ink-950/70 px-3 py-2 backdrop-blur" aria-label={`Level ${game.level}, ${game.title}, ${game.xp} XP`}>
            <p className="label-mono text-[10px] text-amber-400">Level {game.level} · {game.title}</p>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-cream/10">
              <div
                className="h-full rounded-full bg-amber-400"
                style={{ width: `${game.next_level_xp ? Math.min(100, ((game.xp - game.level_xp) / (game.next_level_xp - game.level_xp)) * 100) : 100}%` }}
              />
            </div>
            <p className="mt-1 text-[11px] text-cream/50">{game.xp} XP{game.next_level_xp ? ` · ${game.next_level_xp - game.xp} to go` : ""}</p>
          </div>
        ) : (
          <span />
        )}
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => router.push("/coach")}
          className="pointer-events-auto flex h-11 items-center gap-2 rounded-full border border-amber-400/40 bg-ink-950/70 px-4 text-sm font-semibold text-amber-100 backdrop-blur"
        >
          <span aria-hidden="true">💬</span> Coach
        </button>
      </div>

      {/* room view: next step + hint */}
      {!station && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 p-5 pb-[max(1.25rem,var(--sa-b))] text-center">
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
          <p className="label-mono text-cream/50">Drag the pick around the room · let go to go in</p>
        </div>
      )}

      {/* zoomed in: the object's card */}
      {station && (
        <div
          className={
            wide
              ? "absolute bottom-0 right-0 top-0 flex items-end p-3 pb-[max(0.75rem,var(--sa-b))] pr-[max(0.75rem,var(--sa-r))]"
              : "absolute inset-x-0 bottom-0 p-3 pb-[max(0.75rem,var(--sa-b))]"
          }
          style={wide ? { width: cardW + 24 } : undefined}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
        >
          <div key={station.id} className={`animate-enter-fast w-full rounded-[26px] border border-cream/10 bg-ink-950/90 shadow-2xl backdrop-blur-md ${wide ? "p-4" : "p-5"}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="label-mono text-amber-400">{station.thing}</p>
                <h2 className="mt-1 font-display text-2xl uppercase text-cream">{labelFor(station)}</h2>
              </div>
              <button onClick={() => select(null)} aria-label="Back to the room" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-cream/15 text-cream/70">
                ✕
              </button>
            </div>
            <p className="mt-2 text-[15px] leading-snug text-cream/70">
              {station.id === "guitar"
                ? "Short lessons: learn a chord, play it for the app, practise it with a band, then play a song with it."
                : station.id === "metronome"
                  ? "Jam along with a backing band on the highway. The music waits for your chord changes."
                  : station.blurb}
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

/** Today's three small tasks as a ring; tap for the list. */
function DailyRing({ done, total, tasks }: { done: number; total: number; tasks: { id: string; label: string; done: boolean }[] }) {
  const [open, setOpen] = useState(false);
  const r = 13, c = 2 * Math.PI * r;
  return (
    <div className="pointer-events-auto relative">
      <button
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={`Today's goal: ${done} of ${total} done`}
        className="flex h-[34px] items-center gap-1.5 rounded-full border border-cream/10 bg-ink-950/70 pl-1 pr-3 backdrop-blur"
      >
        <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true">
          <circle cx="16" cy="16" r={r} fill="none" stroke="rgba(var(--cream-rgb),0.12)" strokeWidth="4" />
          <circle cx="16" cy="16" r={r} fill="none" stroke={done >= total ? "rgb(var(--ok-300))" : "rgb(var(--acc-400))"} strokeWidth="4" strokeLinecap="round"
            strokeDasharray={`${(done / total) * c} ${c}`} transform="rotate(-90 16 16)" />
        </svg>
        <span className="text-sm font-semibold text-cream">{done}/{total}</span>
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-10 w-60 rounded-2xl border border-cream/10 bg-ink-950/95 p-3 text-left shadow-xl" onPointerDown={(e) => e.stopPropagation()}>
          <p className="label-mono text-[10px] text-amber-400">Today&apos;s goal</p>
          <ul className="mt-2 space-y-1.5">
            {tasks.map((t) => (
              <li key={t.id} className={`flex items-center gap-2 text-sm ${t.done ? "text-sage-200" : "text-cream/80"}`}>
                <span aria-hidden="true">{t.done ? "✓" : "○"}</span> {t.label}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function labelFor(o: RoomObject): string {
  return o.id === "guitar" ? "Lessons" : o.id === "metronome" ? "Grooves" : o.label;
}

function Chip({ label, value, spoken }: { label: string; value: React.ReactNode; spoken?: string }) {
  return (
    <div className="rounded-full border border-cream/10 bg-ink-950/70 px-3 py-1.5 backdrop-blur" aria-label={`${label}: ${spoken ?? String(value)}`}>
      <span className="label-mono text-cream/50">{label} </span>
      <span className="font-semibold text-cream">{value}</span>
    </div>
  );
}
