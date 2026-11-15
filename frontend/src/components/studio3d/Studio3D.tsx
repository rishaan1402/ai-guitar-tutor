"use client";

/**
 * The app's home: a cozy 3D diorama of a practice studio.
 * Tap an object and the camera flies to it; its card opens the feature.
 * Swipe left/right to move between objects; back (or ✕) returns to the room.
 */
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Canvas, useThree } from "@react-three/fiber";
import { CameraControls, AdaptiveDpr } from "@react-three/drei";
import * as THREE from "three";
import useSWR from "swr";
import { useAuth } from "@/context/AuthContext";
import { getPlan, getProgress, type PlanItem } from "@/lib/api";
import { planTitle } from "@/lib/mastery";
import { planHref } from "@/app/dashboard/_components/TodaysPlan";
import { OVERVIEW, STATIONS, cameraFor, distanceFor, stationById, type StationId } from "./stations";
import { Amp, Cabinet, Door, Guitar, Lamp, MusicStand, Neon, Pedal, Plant, RecordWall, Room, Rug, Turntable, Metronome, Window, type PropsCtx } from "./Props";

/* ------------------------------------------------------------------ camera */

const FOV = 32;

function CameraRig({ focus }: { focus: StationId | null }) {
  const ref = useRef<CameraControls>(null);
  const { size } = useThree();
  const first = useRef(true);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    // the player never drives the camera directly: taps and swipes do
    c.mouseButtons.left = c.mouseButtons.right = c.mouseButtons.middle = c.mouseButtons.wheel = 0;
    c.touches.one = c.touches.two = c.touches.three = 0;
    c.smoothTime = 0.55;
  }, []);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const aspect = size.width / Math.max(size.height, 1);
    const s = focus ? stationById(focus) : null;
    const target = s ? s.target : OVERVIEW.target;
    const frame = s ? s.frame : OVERVIEW.frame;
    // focused: the object sits in the top part of the screen, above its card
    const usable = s ? 0.62 : 0.85;
    const dist = distanceFor(frame, FOV, aspect, usable);
    const pos = cameraFor(target, s ? s.dir : OVERVIEW.dir, dist);
    // shift the view down so the target lands in the middle of the usable area
    const shift = s ? Math.tan((FOV * Math.PI) / 360) * dist * (1 - usable) : 0;
    // the first frame starts further out and glides in
    if (first.current) {
      first.current = false;
      c.setLookAt(pos[0] * 1.3, pos[1] * 1.3, pos[2] * 1.3, ...target, false);
    }
    c.setLookAt(...pos, ...target, true);
    c.setFocalOffset(0, shift, 0, true);
  }, [focus, size.width, size.height]);
  return <CameraControls ref={ref} makeDefault />;
}

/* ------------------------------------------------------------------ scene */

function Scene({ ctx, mastered, streak, guitarGlow }: { ctx: PropsCtx; mastered: number; streak: number; guitarGlow: boolean }) {
  return (
    <>
      <color attach="background" args={["#0c0a09"]} />
      <fog attach="fog" args={["#0c0a09", 22, 40]} />
      <ambientLight intensity={0.5} color="#ffd8b0" />
      <hemisphereLight args={["#b9c4ff", "#3a2010", 0.55]} />
      {/* soft key light from the front-right so the props read on a phone */}
      <directionalLight position={[3, 6, 6]} intensity={1.0} color="#ffe2c0" />
      <Room />
      <Window />
      <Rug />
      <Cabinet />
      <Plant />
      <Lamp streak={streak} />
      <Neon />
      <RecordWall ctx={ctx} mastered={mastered} />
      <Amp ctx={ctx} />
      <Guitar ctx={ctx} glow={guitarGlow} />
      <Pedal ctx={ctx} />
      <MusicStand ctx={ctx} />
      <Turntable ctx={ctx} />
      <Metronome ctx={ctx} />
      <Door ctx={ctx} />
    </>
  );
}

/* ------------------------------------------------------------------ page */

function webglOk(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export default function Studio3D() {
  const router = useRouter();
  const { user } = useAuth();
  const swrOpts = { revalidateOnFocus: false };
  const { data: progress } = useSWR(user ? "/api/progress" : null, getProgress, swrOpts);
  const { data: plan } = useSWR(user ? "/api/plan/next" : null, getPlan, swrOpts);
  const next: PlanItem | undefined = plan?.items?.[0];

  const [focus, setFocus] = useState<StationId | null>(null);
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => setOk(webglOk()), []);

  // Android back / browser back: a focused object returns to the room first
  const select = useCallback((id: StationId | null) => {
    setFocus((cur) => {
      if (id && !cur) window.history.pushState({ studioFocus: true }, "");
      if (!id && cur && window.history.state?.studioFocus) window.history.back();
      return id;
    });
  }, []);
  useEffect(() => {
    const onPop = () => setFocus(null);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const ctx: PropsCtx = useMemo(() => ({ onSelect: (id) => select(id), focus }), [focus, select]);

  // horizontal swipe = next / previous object
  const start = useRef<{ x: number; y: number; t: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => (start.current = { x: e.clientX, y: e.clientY, t: performance.now() });
  const onPointerUp = (e: React.PointerEvent) => {
    const s = start.current;
    start.current = null;
    if (!s) return;
    const dx = e.clientX - s.x, dy = e.clientY - s.y;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.3 || performance.now() - s.t > 700) return;
    const i = focus ? STATIONS.findIndex((st) => st.id === focus) : -1;
    const step = dx < 0 ? 1 : -1;
    const j = i === -1 ? (step === 1 ? 0 : STATIONS.length - 1) : (i + step + STATIONS.length) % STATIONS.length;
    select(STATIONS[j].id);
  };

  function hrefFor(id: StationId): string {
    switch (id) {
      case "guitar":
        return next ? planHref(next) : "/practice?chord=A_minor";
      case "amp":
        return "/practice";
      case "pedal":
        return "/tuner";
      case "stand":
        return "/songs";
      case "turntable":
        return "/practice?mode=song";
      case "metronome":
        return "/practice?mode=transitions";
      case "wall":
        return user ? "/progress" : "/login?next=/progress";
      case "door":
        return user ? "/profile" : "/login";
    }
  }

  const station = focus ? stationById(focus) : null;
  const mastered = progress?.mastered_count ?? 0;
  const streak = progress?.practice_streak ?? 0;

  if (ok === false) {
    // no 3D on this device: a plain list of the same places
    return (
      <div className="min-h-[100dvh] bg-ink-950 p-6 pt-[max(1.5rem,env(safe-area-inset-top))]">
        <h1 className="font-display text-2xl uppercase text-cream">Your studio</h1>
        <div className="mt-6 grid gap-3">
          {STATIONS.map((s) => (
            <button key={s.id} onClick={() => router.push(hrefFor(s.id))} className="rounded-2xl border border-cream/10 p-4 text-left">
              <span className="label-mono block text-amber-400">{s.kicker}</span>
              <span className="mt-1 block text-lg text-cream">{s.label}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 select-none overflow-hidden bg-ink-950 touch-none"
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      data-testid="studio"
    >
      {ok && (
        <Canvas
          shadows
          dpr={[1, 1.75]}
          camera={{ fov: FOV, near: 0.1, far: 80, position: [9, 9, 14] }}
          gl={{ antialias: true, powerPreference: "high-performance" }}
          onCreated={({ gl }) => {
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 1.35;
          }}
        >
          <Suspense fallback={null}>
            <Scene ctx={ctx} mastered={mastered} streak={streak} guitarGlow={!!next} />
          </Suspense>
          <CameraRig focus={focus} />
          <AdaptiveDpr pixelated={false} />
        </Canvas>
      )}

      {/* vignette */}
      <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(120% 90% at 50% 45%, transparent 55%, rgba(0,0,0,0.65) 100%)" }} />

      {/* HUD */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="pointer-events-auto rounded-full border border-cream/10 bg-ink-950/60 px-3 py-1.5 backdrop-blur">
          <span className="label-mono text-amber-400">{user ? user.display_name : "Guest"}</span>
        </div>
        <div className="flex gap-2">
          <Chip label="Streak" value={`${streak}🔥`} />
          <Chip label="Gold" value={`${mastered}`} />
        </div>
      </div>

      {/* hint */}
      {!station && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-center">
          {next && (
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => router.push(planHref(next))}
              className="pointer-events-auto mb-4 inline-flex items-center gap-3 rounded-full bg-amber-400 px-5 py-3 font-semibold text-ink-950 shadow-lg shadow-amber-400/20"
            >
              <span className="label-mono text-ink-950/60">Next up</span> {planTitle(next)} →
            </button>
          )}
          <p className="label-mono text-cream/45">Tap anything · swipe to look around</p>
        </div>
      )}

      {/* object card */}
      {station && (
        <div
          className="absolute inset-x-0 bottom-0 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
        >
          <div key={station.id} className="animate-enter-fast rounded-[26px] border border-cream/10 bg-ink-950/85 p-5 shadow-2xl backdrop-blur-md">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="label-mono text-amber-400">{station.kicker}</p>
                <h2 className="mt-1 font-display text-2xl uppercase text-cream">{station.label}</h2>
              </div>
              <button onClick={() => select(null)} aria-label="Back to the room" className="flex h-10 w-10 items-center justify-center rounded-full border border-cream/15 text-cream/70">
                ✕
              </button>
            </div>
            <p className="mt-2 text-[15px] leading-snug text-cream/70">
              {station.id === "guitar" && next ? `Up next: ${planTitle(next)}. ` : ""}
              {station.blurb}
            </p>
            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={() => router.push(hrefFor(station.id))}
                className="h-12 flex-1 rounded-full bg-amber-400 text-base font-semibold text-ink-950 active:scale-[0.98]"
              >
                {station.id === "door" ? (user ? "Open profile" : "Sign in") : "Enter"} →
              </button>
              <StationDots current={station.id} onPick={select} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-full border border-cream/10 bg-ink-950/60 px-3 py-1.5 backdrop-blur" aria-label={`${label}: ${value}`}>
      <span className="label-mono text-cream/50">{label} </span>
      <span className="font-semibold text-cream">{value}</span>
    </div>
  );
}

function StationDots({ current, onPick }: { current: StationId; onPick: (id: StationId) => void }) {
  return (
    <div className="flex items-center gap-1.5" role="tablist" aria-label="Objects in the room">
      {STATIONS.map((s) => (
        <button
          key={s.id}
          role="tab"
          aria-selected={s.id === current}
          aria-label={s.label}
          onClick={() => onPick(s.id)}
          className={`h-2 rounded-full transition-all ${s.id === current ? "w-5 bg-amber-400" : "w-2 bg-cream/25"}`}
        />
      ))}
    </div>
  );
}
