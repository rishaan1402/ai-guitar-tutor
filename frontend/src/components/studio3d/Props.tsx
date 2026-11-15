"use client";

/**
 * The studio's furniture and instruments, built from primitives + canvas textures.
 * Every interactive prop is wrapped in <Hit id> so a tap selects it.
 * Each prop is its own component, so an artist's glTF model can replace one at a time.
 */
import { useMemo, useRef, type ReactNode } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { RoundedBox, Sparkles } from "@react-three/drei";
import * as THREE from "three";
import type { StationId } from "./stations";
import {
  floorTexture,
  foamTexture,
  grilleTexture,
  neonTexture,
  recordLabelTexture,
  rugTexture,
  sheetTexture,
  sunburstTexture,
  textTexture,
  tolexTexture,
  wallTexture,
} from "./textures";

export interface PropsCtx {
  onSelect: (id: StationId) => void;
  focus: StationId | null;
}

/** Tap target: ignores drags (swipes) and stops the tap reaching objects behind. */
function Hit({ id, ctx, children }: { id: StationId; ctx: PropsCtx; children: ReactNode }) {
  return (
    <group
      onClick={(e: ThreeEvent<MouseEvent>) => {
        if (e.delta > 10) return;
        e.stopPropagation();
        ctx.onSelect(id);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => (document.body.style.cursor = "")}
    >
      {children}
    </group>
  );
}

const WOOD_DARK = "#3b2416";
const WOOD_MID = "#6b3f22";
const BRASS = "#c9a25a";
const CREAM = "#efe2c4";

/* ------------------------------------------------------------------ room */

export function Room() {
  const floor = useMemo(() => floorTexture(), []);
  const wall = useMemo(() => wallTexture(3, [52, 66, 56]), []);
  const sideWall = useMemo(() => wallTexture(4, [46, 58, 50]), []);
  const foam = useMemo(() => foamTexture(), []);
  return (
    <group>
      {/* diorama base */}
      <mesh position={[0, -0.16, -0.65]} receiveShadow>
        <boxGeometry args={[6.4, 0.3, 4.1]} />
        <meshStandardMaterial color="#1e130c" roughness={0.8} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.001, -0.65]} receiveShadow>
        <planeGeometry args={[6, 3.7]} />
        <meshStandardMaterial map={floor} roughness={0.62} metalness={0.02} />
      </mesh>
      {/* back wall + wainscot */}
      <mesh position={[0, 1.6, -2.56]} receiveShadow>
        <boxGeometry args={[6.12, 3.2, 0.12]} />
        <meshStandardMaterial map={wall} roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.45, -2.49]} receiveShadow>
        <boxGeometry args={[6, 0.9, 0.03]} />
        <meshStandardMaterial color={WOOD_DARK} roughness={0.55} />
      </mesh>
      <mesh position={[0, 0.92, -2.47]}>
        <boxGeometry args={[6, 0.05, 0.06]} />
        <meshStandardMaterial color={WOOD_MID} roughness={0.5} />
      </mesh>
      {/* left wall + wainscot */}
      <mesh position={[-3.06, 1.6, -0.65]} receiveShadow>
        <boxGeometry args={[0.12, 3.2, 3.7]} />
        <meshStandardMaterial map={sideWall} roughness={0.95} />
      </mesh>
      <mesh position={[-2.99, 0.45, -0.65]} receiveShadow>
        <boxGeometry args={[0.03, 0.9, 3.7]} />
        <meshStandardMaterial color={WOOD_DARK} roughness={0.55} />
      </mesh>
      {/* acoustic foam on the back wall, right of the neon */}
      {[0, 1].map((i) => (
        <mesh key={i} position={[0.35 + i * 0.62, 1.7, -2.48]}>
          <boxGeometry args={[0.56, 0.56, 0.05]} />
          <meshStandardMaterial map={foam} roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

export function Window() {
  return (
    <group position={[-2.98, 1.85, -1.35]} rotation-y={Math.PI / 2}>
      <mesh>
        <boxGeometry args={[1.1, 1.2, 0.08]} />
        <meshStandardMaterial color={WOOD_MID} roughness={0.6} />
      </mesh>
      <mesh position-z={0.045}>
        <planeGeometry args={[0.96, 1.06]} />
        <meshStandardMaterial color="#0f1d3a" emissive="#22407a" emissiveIntensity={0.9} roughness={0.2} />
      </mesh>
      {/* moon + mullions */}
      <mesh position={[0.22, 0.28, 0.05]}>
        <circleGeometry args={[0.08, 32]} />
        <meshBasicMaterial color="#f4ecd2" />
      </mesh>
      <mesh position-z={0.06}>
        <boxGeometry args={[0.04, 1.06, 0.02]} />
        <meshStandardMaterial color={WOOD_MID} />
      </mesh>
      <mesh position-z={0.06}>
        <boxGeometry args={[0.96, 0.04, 0.02]} />
        <meshStandardMaterial color={WOOD_MID} />
      </mesh>
      <pointLight position={[0, 0, 0.6]} color="#7d9cff" intensity={1.6} distance={3.5} />
    </group>
  );
}

export function Rug() {
  const tex = useMemo(() => rugTexture(), []);
  return (
    <mesh rotation-x={-Math.PI / 2} position={[-0.2, 0.006, -0.75]} receiveShadow>
      <planeGeometry args={[3.3, 2.06]} />
      <meshStandardMaterial map={tex} roughness={0.95} />
    </mesh>
  );
}

export function Plant() {
  const leaves = useMemo(
    () =>
      Array.from({ length: 9 }, (_, i) => ({
        rot: [0.5 + (i % 3) * 0.25, (i / 9) * Math.PI * 2, 0] as [number, number, number],
        s: 0.8 + (i % 4) * 0.12,
      })),
    [],
  );
  return (
    <group position={[2.6, 0, 0.6]}>
      <mesh position-y={0.2} castShadow>
        <cylinderGeometry args={[0.17, 0.13, 0.4, 24]} />
        <meshStandardMaterial color="#b0603a" roughness={0.8} />
      </mesh>
      {leaves.map((l, i) => (
        <mesh key={i} position-y={0.42} rotation={l.rot} scale={l.s} castShadow>
          <coneGeometry args={[0.07, 0.6, 5]} />
          <meshStandardMaterial color={i % 2 ? "#3f6b46" : "#56875a"} roughness={0.7} />
        </mesh>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ amp */

export function Amp({ ctx }: { ctx: PropsCtx }) {
  const tolex = useMemo(() => tolexTexture(), []);
  const grille = useMemo(() => grilleTexture(), []);
  const logo = useMemo(
    () => textTexture("amp-logo", [{ text: "OPEN·STR", font: "italic 900 92px Georgia, serif", color: "#f1e2bf", y: 64 }], 512, 128),
    [],
  );
  const needle = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!needle.current) return;
    const t = clock.elapsedTime;
    needle.current.rotation.z = -0.5 + 0.35 * (0.5 + 0.5 * Math.sin(t * 2.3) * Math.sin(t * 0.7 + 1));
  });
  const W = 0.92, H = 0.74, D = 0.44;
  return (
    <Hit id="amp" ctx={ctx}>
      <group position={[-1.75, 0, -1.75]} rotation-y={0.28}>
        {/* cabinet */}
        <mesh position-y={H / 2 + 0.03} castShadow receiveShadow>
          <boxGeometry args={[W, H, D]} />
          <meshStandardMaterial map={tolex} roughness={0.75} />
        </mesh>
        {/* grille + piping */}
        <mesh position={[0, 0.33, D / 2 + 0.002]}>
          <planeGeometry args={[W - 0.1, 0.5]} />
          <meshStandardMaterial map={grille} roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.33, D / 2 + 0.001]}>
          <planeGeometry args={[W - 0.08, 0.52]} />
          <meshStandardMaterial color={CREAM} roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.36, D / 2 + 0.005]}>
          <planeGeometry args={[0.36, 0.09]} />
          <meshStandardMaterial map={logo} transparent roughness={0.4} />
        </mesh>
        {/* control panel */}
        <mesh position={[0, 0.69, D / 2 - 0.02]} rotation-x={-0.25}>
          <boxGeometry args={[W - 0.06, 0.12, 0.06]} />
          <meshStandardMaterial color="#b9a171" metalness={0.75} roughness={0.32} />
        </mesh>
        {Array.from({ length: 6 }, (_, i) => (
          <group key={i} position={[-0.36 + i * 0.1, 0.695, D / 2 + 0.02]} rotation-x={Math.PI / 2 - 0.25}>
            <mesh castShadow>
              <cylinderGeometry args={[0.022, 0.026, 0.03, 20]} />
              <meshStandardMaterial color="#181412" roughness={0.35} />
            </mesh>
            <mesh position={[0, 0.016, -0.012]}>
              <boxGeometry args={[0.004, 0.003, 0.02]} />
              <meshBasicMaterial color={CREAM} />
            </mesh>
          </group>
        ))}
        {/* VU meter */}
        <group position={[0.29, 0.695, D / 2 + 0.012]} rotation-x={-0.25}>
          <mesh>
            <planeGeometry args={[0.12, 0.075]} />
            <meshStandardMaterial color="#f0c46a" emissive="#e8a54b" emissiveIntensity={1.2} />
          </mesh>
          <mesh ref={needle} position={[0, -0.03, 0.002]}>
            <boxGeometry args={[0.003, 0.06, 0.002]} />
            <meshBasicMaterial color="#2a120a" />
          </mesh>
        </group>
        {/* jewel light */}
        <mesh position={[0.41, 0.695, D / 2 + 0.03]}>
          <sphereGeometry args={[0.014, 16, 16]} />
          <meshStandardMaterial color="#ff4a32" emissive="#ff3a22" emissiveIntensity={3} />
        </mesh>
        {/* handle + corners */}
        <mesh position-y={H + 0.06} rotation-x={Math.PI / 2}>
          <torusGeometry args={[0.1, 0.014, 10, 24, Math.PI]} />
          <meshStandardMaterial color="#120f0d" roughness={0.6} />
        </mesh>
        {[-1, 1].flatMap((sx) =>
          [0.05, H].map((y) => (
            <mesh key={`${sx}${y}`} position={[sx * (W / 2 - 0.02), y, D / 2 - 0.02]}>
              <boxGeometry args={[0.06, 0.06, 0.06]} />
              <meshStandardMaterial color="#9c9488" metalness={0.8} roughness={0.35} />
            </mesh>
          )),
        )}
        <pointLight position={[0.41, 0.72, D / 2 + 0.12]} color="#ff5a3a" intensity={0.35} distance={1.2} />
      </group>
    </Hit>
  );
}

/* ------------------------------------------------------------------ guitar */

function guitarShape() {
  // Acoustic body outline, ~0.48 m tall, waist at 45%
  const s = new THREE.Shape();
  s.moveTo(0, -0.24);
  s.bezierCurveTo(0.2, -0.24, 0.22, -0.1, 0.16, -0.02);
  s.bezierCurveTo(0.12, 0.03, 0.15, 0.08, 0.15, 0.13);
  s.bezierCurveTo(0.15, 0.22, 0.07, 0.24, 0, 0.24);
  s.bezierCurveTo(-0.07, 0.24, -0.15, 0.22, -0.15, 0.13);
  s.bezierCurveTo(-0.15, 0.08, -0.12, 0.03, -0.16, -0.02);
  s.bezierCurveTo(-0.22, -0.1, -0.2, -0.24, 0, -0.24);
  return s;
}

export function Guitar({ ctx, glow }: { ctx: PropsCtx; glow: boolean }) {
  const top = useMemo(() => {
    const g = new THREE.ShapeGeometry(guitarShape(), 48);
    g.computeBoundingBox();
    const bb = g.boundingBox!;
    const pos = g.attributes.position;
    const uv = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      uv[i * 2] = (pos.getX(i) - bb.min.x) / (bb.max.x - bb.min.x);
      uv[i * 2 + 1] = (pos.getY(i) - bb.min.y) / (bb.max.y - bb.min.y);
    }
    g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    return g;
  }, []);
  const sides = useMemo(
    () => new THREE.ExtrudeGeometry(guitarShape(), { depth: 0.09, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.006, bevelSegments: 2, curveSegments: 48 }),
    [],
  );
  const burst = useMemo(() => sunburstTexture(), []);
  const halo = useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => {
    if (halo.current) halo.current.intensity = glow ? 0.6 + 0.4 * Math.sin(clock.elapsedTime * 2.4) : 0;
  });
  return (
    <Hit id="guitar" ctx={ctx}>
      <group position={[-0.72, 0, -1.55]} rotation-y={-0.22}>
        {/* A-frame stand: cradle under the body, legs behind it */}
        {[-1, 1].map((sx) => (
          <mesh key={sx} position={[sx * 0.13, 0.16, -0.12]} rotation={[-0.35, 0, sx * 0.18]} castShadow>
            <cylinderGeometry args={[0.009, 0.009, 0.36, 8]} />
            <meshStandardMaterial color="#1a1a1a" metalness={0.6} roughness={0.4} />
          </mesh>
        ))}
        <mesh position={[0, 0.07, 0.02]} rotation-z={Math.PI / 2} castShadow>
          <cylinderGeometry args={[0.012, 0.012, 0.3, 8]} />
          <meshStandardMaterial color="#1a1a1a" metalness={0.6} roughness={0.4} />
        </mesh>
        <group position={[0, 0.32, 0]} rotation-x={-0.2}>
          {/* body: sides + back, then the sunburst top on the front face */}
          <mesh geometry={sides} position-z={-0.1} castShadow>
            <meshStandardMaterial color="#3a1c0c" roughness={0.45} />
          </mesh>
          <mesh geometry={top} position-z={0.0075}>
            <meshPhysicalMaterial map={burst} roughness={0.28} clearcoat={0.8} clearcoatRoughness={0.15} />
          </mesh>
          {/* soundhole + rosette + bridge + pickguard */}
          <mesh position={[0, 0.07, 0.009]}>
            <ringGeometry args={[0.045, 0.056, 40]} />
            <meshStandardMaterial color={CREAM} roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.07, 0.0085]}>
            <circleGeometry args={[0.045, 40]} />
            <meshBasicMaterial color="#0b0604" />
          </mesh>
          <mesh position={[0, -0.13, 0.012]}>
            <boxGeometry args={[0.1, 0.018, 0.008]} />
            <meshStandardMaterial color="#2a1408" roughness={0.4} />
          </mesh>
          <mesh position={[0, -0.122, 0.017]}>
            <boxGeometry args={[0.06, 0.003, 0.004]} />
            <meshStandardMaterial color={CREAM} />
          </mesh>
          {/* neck on the body's top surface, fretboard, frets, nut, headstock */}
          <mesh position={[0, 0.5, -0.008]} castShadow>
            <boxGeometry args={[0.046, 0.56, 0.026]} />
            <meshStandardMaterial color="#8a5a32" roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.48, 0.008]}>
            <boxGeometry args={[0.046, 0.6, 0.006]} />
            <meshStandardMaterial color="#20120a" roughness={0.6} />
          </mesh>
          {Array.from({ length: 12 }, (_, i) => (
            <mesh key={i} position={[0, 0.76 - i * 0.04 * (1 - i * 0.025), 0.0115]}>
              <boxGeometry args={[0.046, 0.002, 0.002]} />
              <meshStandardMaterial color="#d8d2c4" metalness={0.9} roughness={0.25} />
            </mesh>
          ))}
          <mesh position={[0, 0.782, 0.012]}>
            <boxGeometry args={[0.048, 0.006, 0.006]} />
            <meshStandardMaterial color={CREAM} />
          </mesh>
          <mesh position={[0, 0.87, -0.012]} rotation-x={0.25} castShadow>
            <boxGeometry args={[0.075, 0.17, 0.02]} />
            <meshStandardMaterial color="#2a140a" roughness={0.4} />
          </mesh>
          {[-1, 1].flatMap((sx) =>
            [0, 1, 2].map((k) => (
              <mesh key={`${sx}${k}`} position={[sx * 0.05, 0.82 + k * 0.045, -0.02]} rotation-z={Math.PI / 2}>
                <cylinderGeometry args={[0.008, 0.008, 0.03, 10]} />
                <meshStandardMaterial color={BRASS} metalness={0.9} roughness={0.25} />
              </mesh>
            )),
          )}
          {/* strings: bridge to nut */}
          {Array.from({ length: 6 }, (_, i) => (
            <mesh key={i} position={[-0.0175 + i * 0.007, 0.325, 0.0145]}>
              <boxGeometry args={[0.0011, 0.905, 0.0011]} />
              <meshStandardMaterial color="#e9e4d8" metalness={1} roughness={0.2} />
            </mesh>
          ))}
        </group>
        <pointLight ref={halo} position={[0, 0.45, 0.35]} color="#ffb347" intensity={0} distance={1.1} />
      </group>
    </Hit>
  );
}

/* ------------------------------------------------------------------ pedal */

export function Pedal({ ctx }: { ctx: PropsCtx }) {
  const led = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    if (led.current) led.current.emissiveIntensity = 1.6 + Math.sin(clock.elapsedTime * 3) * 0.8;
  });
  const screen = useMemo(
    () => textTexture("pedal-screen", [{ text: "E", font: "700 150px monospace", color: "#86f0a0", y: 128 }], 256, 256, "#07140b"),
    [],
  );
  return (
    <Hit id="pedal" ctx={ctx}>
      <group position={[-1.32, 0, -0.82]} rotation-y={0.35}>
        <RoundedBox args={[0.16, 0.06, 0.24]} radius={0.012} position-y={0.03} castShadow>
          <meshStandardMaterial color="#c4372a" roughness={0.38} metalness={0.25} />
        </RoundedBox>
        <mesh position={[0, 0.062, 0.06]}>
          <cylinderGeometry args={[0.018, 0.02, 0.02, 20]} />
          <meshStandardMaterial color="#d6d2c8" metalness={0.95} roughness={0.2} />
        </mesh>
        <mesh position={[0, 0.061, -0.05]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[0.07, 0.05]} />
          <meshStandardMaterial map={screen} emissiveMap={screen} emissive="#ffffff" emissiveIntensity={0.9} />
        </mesh>
        <mesh position={[0.05, 0.062, -0.095]}>
          <sphereGeometry args={[0.007, 12, 12]} />
          <meshStandardMaterial ref={led} color="#5cff8a" emissive="#3bff6e" emissiveIntensity={2} />
        </mesh>
        {/* cable to the amp */}
        <mesh position={[-0.12, 0.012, -0.32]} rotation={[Math.PI / 2, 0, 0.6]}>
          <torusGeometry args={[0.28, 0.006, 6, 30, 1.8]} />
          <meshStandardMaterial color="#141414" roughness={0.8} />
        </mesh>
      </group>
    </Hit>
  );
}

/* ------------------------------------------------------------------ music stand */

export function MusicStand({ ctx }: { ctx: PropsCtx }) {
  const sheet = useMemo(() => sheetTexture(["Em", "C", "G", "D"]), []);
  return (
    <Hit id="stand" ctx={ctx}>
      <group position={[0.55, 0, -0.55]} rotation-y={-0.3}>
        {[0, 1, 2].map((i) => (
          <mesh key={i} position={[Math.sin((i * Math.PI * 2) / 3) * 0.12, 0.12, Math.cos((i * Math.PI * 2) / 3) * 0.12]} rotation={[Math.cos((i * Math.PI * 2) / 3) * 0.7, 0, -Math.sin((i * Math.PI * 2) / 3) * 0.7]} castShadow>
            <cylinderGeometry args={[0.007, 0.007, 0.32, 8]} />
            <meshStandardMaterial color="#202020" metalness={0.7} roughness={0.35} />
          </mesh>
        ))}
        <mesh position-y={0.55} castShadow>
          <cylinderGeometry args={[0.011, 0.011, 0.95, 10]} />
          <meshStandardMaterial color="#202020" metalness={0.7} roughness={0.35} />
        </mesh>
        <group position={[0, 1.1, 0.03]} rotation-x={-0.3}>
          <mesh castShadow>
            <boxGeometry args={[0.56, 0.38, 0.012]} />
            <meshStandardMaterial color="#1b1b1b" metalness={0.6} roughness={0.4} />
          </mesh>
          <mesh position={[0, -0.2, 0.025]}>
            <boxGeometry args={[0.56, 0.02, 0.05]} />
            <meshStandardMaterial color="#1b1b1b" metalness={0.6} roughness={0.4} />
          </mesh>
          <mesh position={[0, 0.03, 0.008]} rotation-z={0.02}>
            <planeGeometry args={[0.3, 0.39]} />
            <meshStandardMaterial map={sheet} roughness={0.9} />
          </mesh>
          <mesh position={[0.08, 0.02, 0.006]} rotation-z={-0.05}>
            <planeGeometry args={[0.3, 0.39]} />
            <meshStandardMaterial color="#e6d9bd" roughness={0.9} />
          </mesh>
        </group>
      </group>
    </Hit>
  );
}

/* ------------------------------------------------------------------ cabinet, turntable, metronome */

export function Cabinet() {
  const spines = useMemo(
    () => Array.from({ length: 22 }, (_, i) => ["#c9452f", "#e8a54b", "#86b092", "#e9d9b8", "#3b5a7a", "#7a3b5a"][(i * 7) % 6]),
    [],
  );
  return (
    <group position={[2.05, 0, -1.9]}>
      <mesh position-y={0.32} castShadow receiveShadow>
        <boxGeometry args={[1.4, 0.6, 0.55]} />
        <meshStandardMaterial color="#5a3420" roughness={0.55} />
      </mesh>
      {/* open shelf with record spines */}
      <mesh position={[-0.33, 0.32, 0.27]}>
        <boxGeometry args={[0.62, 0.5, 0.02]} />
        <meshStandardMaterial color="#1c100a" />
      </mesh>
      {spines.map((c, i) => (
        <mesh key={i} position={[-0.61 + i * 0.026, 0.31, 0.24]} rotation-z={i % 7 === 3 ? 0.08 : 0}>
          <boxGeometry args={[0.018, 0.44, 0.04]} />
          <meshStandardMaterial color={c} roughness={0.7} />
        </mesh>
      ))}
      <mesh position={[0.36, 0.32, 0.278]}>
        <boxGeometry args={[0.6, 0.5, 0.01]} />
        <meshStandardMaterial color="#6b4026" roughness={0.5} />
      </mesh>
      <mesh position={[0.12, 0.32, 0.29]}>
        <sphereGeometry args={[0.015, 12, 12]} />
        <meshStandardMaterial color={BRASS} metalness={0.9} roughness={0.25} />
      </mesh>
      {[-0.62, 0.62].flatMap((x) =>
        [-0.22, 0.22].map((z) => (
          <mesh key={`${x}${z}`} position={[x, 0.01, z]}>
            <cylinderGeometry args={[0.02, 0.015, 0.04, 8]} />
            <meshStandardMaterial color={BRASS} metalness={0.8} roughness={0.3} />
          </mesh>
        )),
      )}
    </group>
  );
}

export function Turntable({ ctx }: { ctx: PropsCtx }) {
  const platter = useRef<THREE.Group>(null);
  const label = useMemo(() => recordLabelTexture("A", false), []);
  useFrame((_, dt) => {
    if (platter.current) platter.current.rotation.y -= dt * 3.5;
  });
  return (
    <Hit id="turntable" ctx={ctx}>
      <group position={[1.85, 0.62, -1.88]}>
        <RoundedBox args={[0.5, 0.08, 0.38]} radius={0.01} position-y={0.04} castShadow>
          <meshStandardMaterial color="#3a2214" roughness={0.35} />
        </RoundedBox>
        <group ref={platter} position={[-0.05, 0.09, 0]}>
          <mesh>
            <cylinderGeometry args={[0.15, 0.15, 0.015, 48]} />
            <meshStandardMaterial color="#bcbcbc" metalness={0.85} roughness={0.3} />
          </mesh>
          <mesh position-y={0.01}>
            <cylinderGeometry args={[0.145, 0.145, 0.004, 64]} />
            <meshPhysicalMaterial color="#0c0c0c" roughness={0.25} clearcoat={1} clearcoatRoughness={0.3} />
          </mesh>
          <mesh position-y={0.0125} rotation-x={-Math.PI / 2}>
            <circleGeometry args={[0.05, 40]} />
            <meshStandardMaterial map={label} roughness={0.6} />
          </mesh>
        </group>
        {/* tonearm */}
        <mesh position={[0.17, 0.11, -0.11]}>
          <cylinderGeometry args={[0.02, 0.022, 0.04, 16]} />
          <meshStandardMaterial color="#d9d4ca" metalness={0.9} roughness={0.25} />
        </mesh>
        <mesh position={[0.11, 0.135, -0.02]} rotation={[0, 0.5, Math.PI / 2 - 0.08]}>
          <cylinderGeometry args={[0.005, 0.005, 0.24, 8]} />
          <meshStandardMaterial color="#d9d4ca" metalness={0.9} roughness={0.25} />
        </mesh>
        <mesh position={[0.05, 0.125, 0.07]} rotation-y={0.5}>
          <boxGeometry args={[0.025, 0.012, 0.04]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
      </group>
    </Hit>
  );
}

export function Metronome({ ctx }: { ctx: PropsCtx }) {
  const arm = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (arm.current) arm.current.rotation.z = Math.sin(clock.elapsedTime * Math.PI * (72 / 60)) * 0.42;
  });
  return (
    <Hit id="metronome" ctx={ctx}>
      <group position={[2.6, 0.62, -1.82]} rotation-y={-0.4}>
        <mesh position-y={0.15} rotation-y={Math.PI / 4} castShadow>
          <coneGeometry args={[0.13, 0.32, 4, 1, false]} />
          <meshStandardMaterial color="#7a4524" roughness={0.45} />
        </mesh>
        <mesh position={[0, 0.13, 0.075]} rotation-x={-0.4}>
          <planeGeometry args={[0.06, 0.18]} />
          <meshStandardMaterial color="#efe2c4" roughness={0.6} />
        </mesh>
        <group ref={arm} position={[0, 0.05, 0.085]}>
          <mesh position-y={0.11}>
            <boxGeometry args={[0.006, 0.22, 0.004]} />
            <meshStandardMaterial color="#d9d4ca" metalness={0.9} roughness={0.25} />
          </mesh>
          <mesh position-y={0.15}>
            <boxGeometry args={[0.024, 0.02, 0.012]} />
            <meshStandardMaterial color={BRASS} metalness={0.9} roughness={0.25} />
          </mesh>
        </group>
      </group>
    </Hit>
  );
}

/* ------------------------------------------------------------------ wall of records */

const WALL_CHORDS = ["Em", "Am", "E", "A", "D", "G", "C", "Dm"];

export function RecordWall({ ctx, mastered }: { ctx: PropsCtx; mastered: number }) {
  return (
    <Hit id="wall" ctx={ctx}>
      <group position={[-1.05, 1.95, -2.48]}>
        {WALL_CHORDS.map((ch, i) => {
          const gold = i < mastered;
          const x = -0.75 + (i % 4) * 0.5;
          const y = i < 4 ? 0.28 : -0.28;
          return <RecordFrame key={ch} chord={ch} gold={gold} position={[x, y, 0]} />;
        })}
        <mesh position={[0, -0.62, 0.02]}>
          <planeGeometry args={[1.0, 0.1]} />
          <meshStandardMaterial
            map={textTexture("wall-plate", [{ text: "HALL OF CLEAN TAKES", font: "700 46px monospace", color: "#3a2a14", y: 40 }], 768, 80, "#d9c9a2")}
            roughness={0.5}
            metalness={0.3}
          />
        </mesh>
      </group>
    </Hit>
  );
}

function RecordFrame({ chord, gold, position }: { chord: string; gold: boolean; position: [number, number, number] }) {
  const label = useMemo(() => recordLabelTexture(chord, gold), [chord, gold]);
  return (
    <group position={position}>
      <mesh castShadow>
        <boxGeometry args={[0.44, 0.44, 0.035]} />
        <meshStandardMaterial color="#17110d" roughness={0.5} />
      </mesh>
      <mesh position-z={0.019}>
        <planeGeometry args={[0.39, 0.39]} />
        <meshStandardMaterial color={gold ? "#2a1f12" : "#1d1a18"} roughness={0.9} />
      </mesh>
      <mesh position-z={0.024} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.165, 0.165, 0.004, 48]} />
        {gold ? (
          <meshStandardMaterial color="#f0c35c" metalness={1} roughness={0.22} />
        ) : (
          <meshStandardMaterial color="#141414" roughness={0.35} transparent opacity={0.55} />
        )}
      </mesh>
      <mesh position-z={0.027}>
        <circleGeometry args={[0.062, 40]} />
        <meshStandardMaterial map={label} roughness={0.6} transparent opacity={gold ? 1 : 0.6} />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ neon, door, lamp */

export function Neon({ text = "OPEN STRINGS" }: { text?: string }) {
  const tex = useMemo(() => neonTexture(text, "#ff6a3d", "Arial Black, Arial, sans-serif"), [text]);
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  const light = useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    // flickers on at launch, then hums
    const on = t < 1.2 ? (Math.sin(t * 40) > 0.2 ? 1 : 0.25) : 0.92 + Math.sin(t * 9) * 0.04;
    if (mat.current) mat.current.opacity = on;
    if (light.current) light.current.intensity = 2.2 * on;
  });
  return (
    <group position={[1.45, 2.45, -2.47]}>
      <mesh>
        <planeGeometry args={[1.25, 0.47]} />
        <meshBasicMaterial ref={mat} map={tex} transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <pointLight ref={light} position={[0, 0, 0.35]} color="#ff5a2e" intensity={2.2} distance={2.6} />
    </group>
  );
}

export function Door({ ctx }: { ctx: PropsCtx }) {
  return (
    <Hit id="door" ctx={ctx}>
      <group position={[-2.98, 0, 0.55]} rotation-y={Math.PI / 2}>
        <mesh position-y={1.06} castShadow>
          <boxGeometry args={[1.04, 2.16, 0.06]} />
          <meshStandardMaterial color="#2a1a10" roughness={0.6} />
        </mesh>
        <mesh position={[0, 1.04, 0.035]}>
          <boxGeometry args={[0.9, 2.04, 0.04]} />
          <meshStandardMaterial color="#8a5530" roughness={0.5} />
        </mesh>
        {[0.55, 1.5].map((y) => (
          <mesh key={y} position={[0, y, 0.06]}>
            <boxGeometry args={[0.66, 0.7, 0.015]} />
            <meshStandardMaterial color="#7a4826" roughness={0.55} />
          </mesh>
        ))}
        <mesh position={[0.34, 1.0, 0.08]}>
          <sphereGeometry args={[0.035, 16, 16]} />
          <meshStandardMaterial color={BRASS} metalness={0.9} roughness={0.2} />
        </mesh>
        {/* warm light under the door */}
        <mesh position={[0, 0.012, 0.06]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[0.88, 0.12]} />
          <meshBasicMaterial color="#ffb45c" transparent opacity={0.35} toneMapped={false} />
        </mesh>
      </group>
    </Hit>
  );
}

/** Floor lamp: its warmth follows the streak (no streak = dim). */
export function Lamp({ streak }: { streak: number }) {
  const intensity = 2.2 + Math.min(streak, 14) * 0.18;
  return (
    <group position={[2.6, 0, -0.55]}>
      <mesh position-y={0.015} castShadow>
        <cylinderGeometry args={[0.16, 0.18, 0.03, 32]} />
        <meshStandardMaterial color="#1b1b1b" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position-y={0.8} castShadow>
        <cylinderGeometry args={[0.012, 0.012, 1.6, 10]} />
        <meshStandardMaterial color={BRASS} metalness={0.85} roughness={0.3} />
      </mesh>
      <mesh position-y={1.66} castShadow>
        <cylinderGeometry args={[0.13, 0.24, 0.26, 32, 1, true]} />
        <meshStandardMaterial color="#e8c88f" emissive="#ffb15c" emissiveIntensity={0.9} side={THREE.DoubleSide} roughness={0.8} />
      </mesh>
      <pointLight position={[0, 1.55, 0]} color="#ffb76b" intensity={intensity} distance={6} decay={1.6} castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.002} />
      <Sparkles count={40} scale={[1.6, 1.4, 1.6]} position={[-0.5, 1.0, 0]} size={1.6} speed={0.25} opacity={0.5} color="#ffd9a0" />
    </group>
  );
}
