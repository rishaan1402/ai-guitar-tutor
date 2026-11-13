/**
 * The exact shape to draw for a chord symbol, so a diagram always matches its
 * caption. Plain chords use the lesson's fingering; slash chords (G/B, D/F#,
 * C/G, Am/G) get a real voicing with the asked-for bass note as the lowest
 * sounding string, or say plainly that the bass isn't shown.
 */
import type { FretPosition } from "./api";
import { parseChord } from "./chordpro";

const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLAT: Record<string, string> = { Db: "C#", Eb: "D#", Gb: "F#", Ab: "G#", Bb: "A#", Cb: "B", Fb: "E" };
// open-string pitch classes, string 1 (high e) .. 6 (low E)
const OPEN: Record<number, number> = { 1: 4, 2: 11, 3: 7, 4: 2, 5: 9, 6: 4 };

const pc = (note: string) => NOTES.indexOf(FLAT[note] ?? note);

export interface Shape {
  positions: FretPosition[];
  /** Caption to show: the symbol as written. */
  caption: string;
  /** Extra line under the diagram when the shape is approximate. */
  note?: string;
}

type Played = Map<number, { fret: number; finger?: number }>;

function played(positions: FretPosition[]): Played {
  const m: Played = new Map();
  for (const p of positions) {
    if (p.action === "mute" || p.string < 1 || p.string > 6) continue;
    const prev = m.get(p.string);
    const fret = p.fret ?? 0;
    if (!prev || fret > prev.fret) m.set(p.string, { fret, finger: p.finger });
  }
  return m;
}

function toPositions(m: Played): FretPosition[] {
  const out: FretPosition[] = [];
  for (let s = 6; s >= 1; s--) {
    const v = m.get(s);
    if (!v) out.push({ string: s, action: "mute" });
    else out.push({ string: s, fret: v.fret, note: NOTES[(OPEN[s] + v.fret) % 12], ...(v.fret > 0 && v.finger ? { finger: v.finger } : {}) });
  }
  return out;
}

const pcsOf = (m: Played) => new Set(Array.from(m).map(([s, v]) => (OPEN[s] + v.fret) % 12));

/**
 * Re-voice `positions` so `bass` is the lowest sounding note while every
 * note of the original chord still sounds. Returns null when no playable
 * voicing exists near the shape.
 */
export function slashVoicing(positions: FretPosition[], bass: string): FretPosition[] | null {
  const b = pc(bass);
  if (b < 0) return null;
  const base = played(positions);
  if (base.size === 0) return null;
  const tones = pcsOf(base);
  const fretted = Array.from(base.values()).map((v) => v.fret).filter((f) => f > 0);
  const lo = fretted.length ? Math.min(...fretted) : 1;
  const hi = fretted.length ? Math.max(...fretted) : 1;
  const usedFingers = new Set(Array.from(base.values()).map((v) => v.finger).filter(Boolean) as number[]);
  const freeFinger = [1, 2, 3, 4].find((f) => !usedFingers.has(f));

  const keeps = (m: Played) => Array.from(tones).every((t) => pcsOf(m).has(t));
  const muteBelow = (m: Played, s: number) => {
    const out: Played = new Map(m);
    for (let x = 6; x > s; x--) out.delete(x);
    return out;
  };

  // 1) the bass is already on a string: mute everything under it
  for (let s = 6; s >= 3; s--) {
    const v = base.get(s);
    if (v && (OPEN[s] + v.fret) % 12 === b) {
      const m = muteBelow(base, s);
      if (keeps(m)) return toPositions(m);
    }
  }
  // 2) add the bass on a lower string, open or within the hand's reach
  for (let s = 6; s >= 4; s--) {
    const fret = ((b - OPEN[s]) % 12 + 12) % 12;
    const reachable = fret === 0 || (fret >= Math.max(1, hi - 3) && fret <= lo + 3);
    if (!reachable) continue;
    const m = muteBelow(base, s);
    const existing = base.get(s);
    if (fret > 0 && !existing?.finger && !freeFinger) continue;
    m.set(s, { fret, finger: fret > 0 ? (existing?.finger ?? freeFinger) : undefined });
    if (keeps(m)) return toPositions(m);
  }
  return null;
}

/** Shape for `symbol` given its lesson fingering (looked up by the base chord). */
export function shapeFor(symbol: string, positions: FretPosition[]): Shape {
  const c = parseChord(symbol);
  if (c?.bass) {
    const v = slashVoicing(positions, c.bass);
    if (v) return { positions: v, caption: symbol };
    return { positions, caption: symbol, note: `${c.root}${c.quality} shape — add ${c.bass} in the bass` };
  }
  return { positions, caption: symbol };
}

/** "x32010"-style fret string, low E first (for labels and screen readers). */
export function fretString(positions: FretPosition[]): string {
  const m = played(positions);
  return [6, 5, 4, 3, 2, 1].map((s) => (m.has(s) ? String(m.get(s)!.fret) : "x")).join(m.size && Array.from(m.values()).some((v) => v.fret > 9) ? "-" : "");
}

/** Display a data caption with proper flat glyphs: "Am7b5" -> "Am7♭5". */
export function prettySymbol(s: string): string {
  return s.replace(/m7b5$/, "m7♭5");
}
