/**
 * The practice room illustration (pure SVG, no assets). Purely visual:
 * interaction lives in <Room>, which overlays real links on these objects.
 *
 * Layers carry a parallax depth via CSS custom properties (--mx, --my set on
 * a parent), so the room shifts subtly with the pointer.
 */
import type { RoomObjectId } from "./roomObjects";

export interface RoomState {
  /** Gold records on the wall (mastered chords, max 3 shown). */
  mastered?: number;
  /** Day streak, shown on the wall plaque. */
  streak?: number;
  /** Two short lines on the sheet on the music stand. */
  sheet?: [string, string];
  /** A re-check is due: the amp's LED pulses. */
  recheckDue?: boolean;
}

interface Props {
  active: RoomObjectId | null;
  state?: RoomState;
  /** Draw floor reflections (off for small/low-power renders). */
  reflections?: boolean;
}

const layer = (depth: number) => ({
  transform: `translate(calc(var(--mx, 0) * ${depth}px), calc(var(--my, 0) * ${depth * 0.45}px))`,
  transition: "transform 600ms cubic-bezier(0.16, 1, 0.3, 1)",
});

function Amp({ live }: { live: boolean }) {
  return (
    <g>
      {/* body */}
      <rect x="226" y="414" width="312" height="312" rx="16" fill="#1d1815" stroke="#3a3029" strokeWidth="3" />
      <rect x="226" y="414" width="312" height="74" rx="16" fill="#2b231e" />
      <rect x="226" y="470" width="312" height="18" fill="#2b231e" />
      {/* knobs */}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <g key={i} transform={`translate(${262 + i * 40} 451)`}>
          <circle r="11" fill="#cdbb9c" />
          <circle r="11" fill="none" stroke="#7b6a52" strokeWidth="1.5" />
          <line x1="0" y1="0" x2={4 - i * 1.4} y2="-8" stroke="#2b231e" strokeWidth="2.2" strokeLinecap="round" />
        </g>
      ))}
      {/* power LED */}
      <circle cx="510" cy="451" r="6" fill="#ff5a47" className={live ? "os-led-pulse" : undefined} />
      <circle cx="510" cy="451" r="14" fill="#ff5a47" opacity="0.18" />
      {/* grille */}
      <rect x="248" y="504" width="268" height="200" rx="8" fill="url(#os-cloth)" stroke="#120e0c" strokeWidth="3" />
      <rect x="248" y="504" width="268" height="200" rx="8" fill="url(#os-grille-shade)" />
      {/* badge */}
      <rect x="342" y="680" width="80" height="16" rx="3" fill="#cdbb9c" opacity="0.9" />
      <text x="382" y="692" textAnchor="middle" fontFamily="var(--font-mono), monospace" fontSize="9" fontWeight="600" fill="#2b231e" letterSpacing="1.5">
        OPEN·STR
      </text>
      {/* feet */}
      <rect x="244" y="724" width="34" height="10" rx="3" fill="#0f0c0a" />
      <rect x="486" y="724" width="34" height="10" rx="3" fill="#0f0c0a" />
    </g>
  );
}

// Right half of an acoustic body, mirrored around x = 817.
const R: [number, number][][] = [
  [[868, 446], [892, 482], [890, 526]],
  [[888, 556], [868, 568], [872, 590]],
  [[920, 606], [918, 690], [904, 722]],
  [[888, 752], [852, 760], [817, 760]],
];
const mirror = ([x, y]: [number, number]) => `${1634 - x} ${y}`;
const GUITAR_BODY =
  "M817 446 " +
  R.map((c) => "C" + c.map(([x, y]) => `${x} ${y}`).join(" ")).join(" ") + " " +
  [...R].reverse().map((c, i, arr) => {
    // walk the left side back up: control points reversed, end at previous segment's start
    const start: [number, number] = i === arr.length - 1 ? [817, 446] : arr[i + 1][2];
    return "C" + [c[1], c[0], start].map(mirror).join(" ");
  }).join(" ") + " Z";

function Guitar({ ringing }: { ringing: boolean }) {
  const strings = [0, 1, 2, 3, 4, 5];
  return (
    <g transform="rotate(-5 817 764)">
      {/* stand */}
      <path d="M770 764 L812 600 M864 764 L822 600 M786 700 L848 700" stroke="#2c2520" strokeWidth="7" strokeLinecap="round" fill="none" />
      {/* headstock */}
      <path d="M800 196 L834 196 L830 252 L804 252 Z" fill="#2a1a0e" />
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <circle cx="796" cy={208 + i * 14} r="4" fill="#cdbb9c" />
          <circle cx="838" cy={208 + i * 14} r="4" fill="#cdbb9c" />
        </g>
      ))}
      {/* neck */}
      <rect x="806" y="250" width="22" height="236" fill="#3b2513" />
      {[276, 300, 322, 342, 360, 377, 393, 408, 422, 435, 447].map((y) => (
        <line key={y} x1="806" x2="828" y1={y} y2={y} stroke="#b9a07a" strokeWidth="1.2" opacity="0.7" />
      ))}
      {/* body: one outline — upper bout, waist, lower bout */}
      <path d={GUITAR_BODY} fill="url(#os-wood)" stroke="#2a1a0e" strokeWidth="3" />
      <path d={GUITAR_BODY} fill="url(#os-wood-sheen)" />
      {/* soundhole + rosette */}
      <circle cx="817" cy="566" r="31" fill="none" stroke="#e8a54b" strokeWidth="3" opacity="0.85" />
      <circle cx="817" cy="566" r="26" fill="#120c08" />
      {/* bridge */}
      <rect x="787" y="664" width="60" height="12" rx="4" fill="#2a1a0e" />
      {/* strings */}
      {strings.map((i) => (
        <line
          key={i}
          x1={809 + i * 3.4}
          x2={803 + i * 5.6}
          y1="252"
          y2="668"
          stroke="#e9e1cf"
          strokeWidth={1.6 - i * 0.16}
          opacity="0.85"
          className={ringing ? "os-string-ring" : undefined}
          style={ringing ? { animationDelay: `${i * 13}ms` } : undefined}
        />
      ))}
    </g>
  );
}

function MusicStand({ sheet }: { sheet: [string, string] }) {
  return (
    <g>
      {/* tripod + pole */}
      <path d="M1030 470 L1030 740 M1030 740 L986 770 M1030 740 L1074 770 M1030 740 L1030 774" stroke="#2c2520" strokeWidth="6" strokeLinecap="round" fill="none" />
      {/* desk */}
      <g transform="rotate(-6 1030 360)">
        <rect x="938" y="282" width="184" height="168" rx="6" fill="#211b17" stroke="#3a3029" strokeWidth="3" />
        <rect x="934" y="444" width="192" height="12" rx="4" fill="#2c2520" />
        {/* the chart */}
        <rect x="952" y="294" width="156" height="140" rx="3" fill="#efe6d2" />
        <text x="966" y="318" fontFamily="var(--font-display), sans-serif" fontSize="13" fill="#1d1815">MY SONG</text>
        <text x="966" y="334" fontFamily="var(--font-mono), monospace" fontSize="8.5" fill="#7b6a52" letterSpacing="1">KEY G · CAPO 2</text>
        <line x1="966" x2="1094" y1="342" y2="342" stroke="#cdbb9c" />
        <text x="966" y="364" fontFamily="var(--font-mono), monospace" fontSize="11" fontWeight="600" fill="#1d1815">{sheet[0]}</text>
        <text x="966" y="388" fontFamily="var(--font-mono), monospace" fontSize="11" fontWeight="600" fill="#1d1815">{sheet[1]}</text>
        <text x="966" y="414" fontFamily="var(--font-mono), monospace" fontSize="8" fill="#b5372c" letterSpacing="1">▶ AUTOSCROLL</text>
      </g>
    </g>
  );
}

function RecordPlayer({ playing }: { playing: boolean }) {
  return (
    <g>
      {/* cabinet */}
      <rect x="1148" y="598" width="350" height="140" rx="6" fill="#2a211b" stroke="#3a3029" strokeWidth="3" />
      <rect x="1166" y="616" width="152" height="104" rx="4" fill="#231c17" stroke="#3a3029" strokeWidth="2" />
      <rect x="1328" y="616" width="152" height="104" rx="4" fill="#231c17" stroke="#3a3029" strokeWidth="2" />
      {/* records peeking out */}
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={1176 + i * 12} y="626" width="9" height="88" rx="2" fill={["#d9483b", "#e8a54b", "#efe6d2", "#6a9576"][i]} opacity="0.75" />
      ))}
      <circle cx="1404" cy="668" r="5" fill="#cdbb9c" />
      <rect x="1160" y="736" width="16" height="30" fill="#1a1512" />
      <rect x="1470" y="736" width="16" height="30" fill="#1a1512" />
      {/* plinth */}
      <rect x="1168" y="548" width="236" height="52" rx="8" fill="#5a3d26" />
      <rect x="1168" y="548" width="236" height="10" rx="4" fill="#6e4b2f" />
      {/* platter + vinyl */}
      <ellipse cx="1264" cy="552" rx="80" ry="17" fill="#0d0b0a" />
      <ellipse cx="1264" cy="550" rx="76" ry="15" fill="url(#os-vinyl)" />
      <ellipse cx="1264" cy="550" rx="18" ry="4" fill="#e8a54b" />
      <ellipse cx="1264" cy="550" rx="2.5" ry="1" fill="#2b231e" />
      {/* groove shimmer that sweeps while playing */}
      <ellipse cx="1264" cy="550" rx="56" ry="11" fill="none" stroke="#f3ead8" strokeOpacity="0.12" strokeDasharray="30 200" className={playing ? "os-spin-dash" : undefined} />
      {/* tonearm */}
      <g transform={`rotate(${playing ? 9 : 0} 1374 540)`} style={{ transition: "transform 700ms cubic-bezier(0.16,1,0.3,1)" }}>
        <circle cx="1374" cy="540" r="8" fill="#cdbb9c" />
        <path d="M1374 540 L1318 552" stroke="#cdbb9c" strokeWidth="4" strokeLinecap="round" />
        <rect x="1306" y="547" width="16" height="8" rx="2" fill="#2b231e" />
      </g>
      {/* knob */}
      <circle cx="1188" cy="584" r="6" fill="#cdbb9c" />
    </g>
  );
}

function Metronome({ ticking }: { ticking: boolean }) {
  return (
    <g>
      <path d="M1420 598 L1490 598 L1468 418 L1442 418 Z" fill="#3d2f24" stroke="#5a4532" strokeWidth="2" />
      <path d="M1431 590 L1479 590 L1462 440 L1448 440 Z" fill="#efe6d2" opacity="0.9" />
      {[460, 480, 500, 520, 540, 560].map((y) => (
        <line key={y} x1="1451" x2="1459" y1={y} y2={y} stroke="#7b6a52" strokeWidth="1" />
      ))}
      <g className={ticking ? "os-tick" : undefined} style={{ transformOrigin: "1455px 584px" }}>
        <line x1="1455" y1="584" x2="1455" y2="446" stroke="#1d1815" strokeWidth="2.5" />
        <rect x="1448" y="488" width="14" height="10" rx="2" fill="#d9483b" />
      </g>
    </g>
  );
}

function Pedal() {
  return (
    <g>
      {/* cable to the amp */}
      <path d="M576 742 C 520 760, 560 700, 520 712" stroke="#0f0c0a" strokeWidth="5" fill="none" />
      <rect x="572" y="702" width="146" height="74" rx="12" fill="#b5372c" stroke="#7a241d" strokeWidth="3" />
      <rect x="586" y="712" width="76" height="26" rx="4" fill="#120e0c" />
      {/* needle display */}
      <line x1="600" x2="648" y1="732" y2="732" stroke="#4b3a2e" strokeWidth="1" />
      <line x1="624" y1="732" x2="628" y2="716" stroke="#86b092" strokeWidth="2" strokeLinecap="round" />
      <circle cx="680" cy="722" r="4" fill="#86b092" />
      <circle cx="645" cy="758" r="11" fill="#cdbb9c" stroke="#7b6a52" strokeWidth="2" />
      <text x="690" y="766" fontFamily="var(--font-mono), monospace" fontSize="8" fontWeight="600" fill="#f3ead8" letterSpacing="1">TUNE</text>
    </g>
  );
}

function RecordWall({ mastered, streak }: { mastered: number; streak?: number }) {
  return (
    <g>
      {[0, 1, 2].map((i) => {
        const x = 136 + i * 158;
        const gold = i < mastered;
        return (
          <g key={i}>
            <rect x={x} y="112" width="136" height="136" rx="4" fill="#120e0c" stroke={gold ? "#b98b3c" : "#3a3029"} strokeWidth="5" />
            <circle cx={x + 68} cy="180" r="50" fill={gold ? "url(#os-gold)" : "#1b1714"} />
            {[38, 30, 22].map((r) => (
              <circle key={r} cx={x + 68} cy="180" r={r} fill="none" stroke={gold ? "#7a5a22" : "#2c2520"} strokeOpacity="0.5" />
            ))}
            <circle cx={x + 68} cy="180" r="12" fill={gold ? "#fff2d6" : "#2c2520"} />
          </g>
        );
      })}
      <rect x="196" y="270" width="318" height="34" rx="3" fill="#cdbb9c" opacity="0.88" />
      <text x="355" y="292" textAnchor="middle" fontFamily="var(--font-mono), monospace" fontSize="11" fontWeight="600" fill="#2b231e" letterSpacing="2">
        {streak && streak > 0 ? `${streak}-DAY STREAK · ${mastered} MASTERED` : "HALL OF CLEAN TAKES"}
      </text>
    </g>
  );
}

export default function RoomScene({ active, state = {}, reflections = true }: Props) {
  const sheet = state.sheet ?? ["| G . | D . |", "| Em . | C . |"];
  const objects = (
    <>
      <g data-obj="amp" className={active === "amp" ? "is-active" : undefined}>
        <Amp live={active === "amp" || !!state.recheckDue} />
      </g>
      <g data-obj="guitar" className={active === "guitar" ? "is-active" : undefined}>
        <Guitar ringing={active === "guitar"} />
      </g>
      <g data-obj="stand" className={active === "stand" ? "is-active" : undefined}>
        <MusicStand sheet={sheet} />
      </g>
      <g data-obj="record" className={active === "record" ? "is-active" : undefined}>
        <RecordPlayer playing={active === "record"} />
      </g>
      <g data-obj="metronome" className={active === "metronome" ? "is-active" : undefined}>
        <Metronome ticking={active === "metronome"} />
      </g>
    </>
  );

  return (
    <svg
      viewBox="0 0 1600 900"
      className="os-room block h-full w-full"
      data-active={active ?? ""}
      role="img"
      aria-label="A guitar practice room: an amp, an acoustic guitar on a stand, a music stand with a chord chart, a record player, a metronome, a tuner pedal and gold records on the wall."
    >
      <defs>
        <linearGradient id="os-wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1a1411" />
          <stop offset="1" stopColor="#120e0c" />
        </linearGradient>
        <linearGradient id="os-floor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#241a14" />
          <stop offset="1" stopColor="#0c0a09" />
        </linearGradient>
        <radialGradient id="os-lamp" cx="0.5" cy="0" r="1">
          <stop offset="0" stopColor="#ffcf8a" stopOpacity="0.32" />
          <stop offset="0.55" stopColor="#e8a54b" stopOpacity="0.06" />
          <stop offset="1" stopColor="#e8a54b" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="os-halo" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#e8a54b" stopOpacity="0.16" />
          <stop offset="1" stopColor="#e8a54b" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="os-wood" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e3a253" />
          <stop offset="0.55" stopColor="#b9732f" />
          <stop offset="1" stopColor="#6e3f17" />
        </linearGradient>
        <radialGradient id="os-wood-sheen" cx="0.35" cy="0.25" r="0.7">
          <stop offset="0" stopColor="#fff3d6" stopOpacity="0.28" />
          <stop offset="1" stopColor="#fff3d6" stopOpacity="0" />
        </radialGradient>
        <filter id="os-neon" x="-20%" y="-50%" width="140%" height="200%">
          <feGaussianBlur stdDeviation="6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <radialGradient id="os-vinyl" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#2a2420" />
          <stop offset="0.7" stopColor="#141110" />
          <stop offset="1" stopColor="#0b0908" />
        </radialGradient>
        <radialGradient id="os-gold" cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#fff0c4" />
          <stop offset="0.35" stopColor="#e3b55a" />
          <stop offset="1" stopColor="#8a6424" />
        </radialGradient>
        <pattern id="os-cloth" width="6" height="6" patternUnits="userSpaceOnUse">
          <rect width="6" height="6" fill="#5b1e18" />
          <path d="M0 6 L6 0 M-1 1 L1 -1 M5 7 L7 5" stroke="#7a2a22" strokeWidth="1" />
        </pattern>
        <linearGradient id="os-grille-shade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.35" />
        </linearGradient>
        <linearGradient id="os-reflect-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.4" />
          <stop offset="0.6" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id="os-reflect-mask" maskUnits="userSpaceOnUse" x="0" y="740" width="1600" height="160">
          <rect x="0" y="740" width="1600" height="160" fill="url(#os-reflect-fade)" />
        </mask>
      </defs>

      {/* ── back wall ───────────────────────────────────────────── */}
      <g style={layer(4)}>
        <rect x="-60" y="-40" width="1720" height="700" fill="url(#os-wall)" />
        {/* acoustic panels behind a neon sign */}
        {Array.from({ length: 12 }, (_, i) => (
          <rect key={i} x={1196 + (i % 4) * 92} y={96 + Math.floor(i / 4) * 92} width="84" height="84" rx="6" fill="#1b1512" stroke="#241c17" />
        ))}
        <g className="os-neon" filter="url(#os-neon)" aria-hidden="true">
          <rect x="1214" y="150" width="332" height="154" rx="22" fill="none" stroke="#e8604f" strokeWidth="3" opacity="0.85" />
          <text x="1380" y="214" textAnchor="middle" fontFamily="var(--font-display), sans-serif" fontSize="46" fill="none" stroke="#ffcf8a" strokeWidth="2.4">OPEN</text>
          <text x="1380" y="272" textAnchor="middle" fontFamily="var(--font-display), sans-serif" fontSize="46" fill="none" stroke="#ffcf8a" strokeWidth="2.4">STRINGS</text>
        </g>
        {/* lamps + light cones */}
        {[440, 1060].map((x) => (
          <g key={x}>
            <path d={`M${x - 60} 60 L${x + 60} 60 L${x + 360} 660 L${x - 360} 660 Z`} fill="url(#os-lamp)" />
            <rect x={x - 26} y="40" width="52" height="22" rx="4" fill="#2b231e" />
            <rect x={x - 22} y="58" width="44" height="5" rx="2" fill="#ffd79a" />
          </g>
        ))}
        <ellipse cx="820" cy="470" rx="420" ry="300" fill="url(#os-halo)" />
        <g data-obj="wall" className={active === "wall" ? "is-active" : undefined}>
          <RecordWall mastered={Math.min(3, state.mastered ?? 2)} streak={state.streak} />
        </g>
        {/* skirting */}
        <rect x="-60" y="636" width="1720" height="10" fill="#0f0c0a" />
      </g>

      {/* ── floor ───────────────────────────────────────────────── */}
      <g style={layer(10)}>
        <rect x="-80" y="644" width="1760" height="300" fill="url(#os-floor)" />
        {Array.from({ length: 15 }, (_, i) => {
          const xb = -260 + i * 150;
          return <line key={i} x1={800 + (xb - 800) * 0.32} y1="646" x2={xb} y2="920" stroke="#0c0a09" strokeOpacity="0.55" strokeWidth="2" />;
        })}
        <ellipse cx="820" cy="784" rx="560" ry="74" fill="#3a1511" opacity="0.65" />
        <ellipse cx="820" cy="784" rx="500" ry="58" fill="none" stroke="#7a2a22" strokeOpacity="0.5" strokeWidth="3" strokeDasharray="10 8" />
      </g>

      {/* ── objects + reflections ───────────────────────────────── */}
      <g style={layer(16)}>
        {reflections && (
          <g mask="url(#os-reflect-mask)" transform="translate(0 1500) scale(1 -1)" aria-hidden="true" style={{ pointerEvents: "none" }}>
            <g opacity="0.7">{objects}</g>
          </g>
        )}
        {objects}
      </g>

      {/* ── front ───────────────────────────────────────────────── */}
      <g style={layer(24)}>
        <g data-obj="pedal" className={active === "pedal" ? "is-active" : undefined}>
          <Pedal />
        </g>
      </g>
    </svg>
  );
}
