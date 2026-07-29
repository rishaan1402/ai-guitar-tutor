"use client";

export interface OrbitNote {
  label: string;
  /** hit = heard, miss = expected but not heard, idle = neutral */
  state?: "hit" | "miss" | "idle";
}

interface Props {
  /** Big label in the centre, e.g. "G". */
  center: string;
  centerCaption?: string;
  notes: OrbitNote[];
  className?: string;
}

const RINGS = [70, 112, 152, 190];

const NOTE_STYLE = {
  hit: { stroke: "rgba(134,176,146,0.9)", fill: "rgba(134,176,146,0.18)", text: "#dfece2" },
  miss: { stroke: "rgba(222,122,92,0.9)", fill: "rgba(222,122,92,0.12)", text: "#f6c9b9" },
  idle: { stroke: "rgba(243,234,216,0.45)", fill: "rgba(243,234,216,0.05)", text: "#f3ead8" },
} as const;

/**
 * A guitar sound-hole drawn as orbit rings, with the chord's notes circling it.
 * The rotation is pure CSS, so prefers-reduced-motion stops it.
 */
export default function OrbitRings({ center, centerCaption, notes, className }: Props) {
  return (
    <svg viewBox="-210 -210 420 420" className={className} role="img" aria-label={`${center}: ${notes.map((n) => `${n.label} ${n.state ?? ""}`).join(", ")}`}>
      <defs>
        <radialGradient id="orbit-core" cx="50%" cy="45%" r="55%">
          <stop offset="0%" stopColor="#ffe9c2" stopOpacity="0.95" />
          <stop offset="35%" stopColor="#e8a54b" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#e8a54b" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Rosette rings */}
      {RINGS.map((r, i) => (
        <circle
          key={r}
          r={r}
          fill="none"
          stroke="rgba(243,234,216,0.16)"
          strokeWidth={i === 0 ? 1.2 : 0.8}
          strokeDasharray={i === 2 ? "2 6" : undefined}
        />
      ))}
      <circle r={RINGS[0] - 18} fill="none" stroke="rgba(232,165,75,0.4)" strokeWidth={0.8} style={{ transformOrigin: "center", animation: "ring-breathe 4s ease-in-out infinite" }} />

      {/* Glowing centre: the chord */}
      <circle r={62} fill="url(#orbit-core)" />
      <text y={centerCaption ? 6 : 14} textAnchor="middle" fill="#1c1206" fontSize={44} fontWeight={700} style={{ fontFamily: "var(--font-display)" }}>
        {center}
      </text>
      {centerCaption && (
        <text y={28} textAnchor="middle" fill="rgba(28,18,6,0.7)" fontSize={10} letterSpacing={2} style={{ fontFamily: "var(--font-body)", textTransform: "uppercase" }}>
          {centerCaption}
        </text>
      )}

      {/* Notes in orbit: each ring turns; labels counter-rotate to stay upright */}
      {notes.map((note, k) => {
        const r = RINGS[1 + (k % 3)];
        const start = (360 / notes.length) * k;
        const duration = 38 + (k % 3) * 14;
        const s = NOTE_STYLE[note.state ?? "idle"];
        return (
          <g key={`${note.label}-${k}`} style={{ transform: `rotate(${start}deg)` }}>
            <g style={{ transformOrigin: "0 0", animation: `orbit-spin ${duration}s linear infinite` }}>
              <line x1={0} y1={-RINGS[0]} x2={0} y2={-r + 17} stroke={s.stroke} strokeOpacity={0.25} strokeWidth={0.7} strokeDasharray="1 4" />
              <g transform={`translate(0 ${-r})`}>
                <g style={{ transformOrigin: "0 0", animation: `orbit-spin ${duration}s linear infinite reverse` }}>
                  <g style={{ transform: `rotate(${-start}deg)` }}>
                    <circle r={17} fill={s.fill} stroke={s.stroke} strokeWidth={1} />
                    <text y={5} textAnchor="middle" fill={s.text} fontSize={13} fontWeight={600} style={{ fontFamily: "var(--font-display)" }}>
                      {note.label}
                    </text>
                  </g>
                </g>
              </g>
            </g>
          </g>
        );
      })}
    </svg>
  );
}
