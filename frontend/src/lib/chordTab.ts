/**
 * Guitar tabs generated from the app's own chord fingerings.
 *
 * We don't transcribe a song's actual riffs (that would copy the recorded
 * arrangement, and an LLM gets it wrong). Instead each chord gets a strum
 * shape and a picking pattern built from its fingering, so the tabs always
 * match the chord the chart is currently showing after transpose, capo or
 * simplify.
 */
import type { FretPosition } from "./api";

export const STRING_NAMES = ["e", "B", "G", "D", "A", "E"]; // string 1 (high e) .. 6 (low E)

export type TabPattern = "strum" | "arpeggio" | "travis";

interface StringFret {
  string: number; // 1..6
  fret: number | null; // null = muted
}

/** Normalise positions to one entry per string (1..6), muted when absent or marked mute. */
export function stringFrets(positions: FretPosition[]): StringFret[] {
  const byString = new Map<number, number | null>();
  for (const p of positions) {
    if (p.string < 1 || p.string > 6) continue;
    if (p.action === "mute") {
      if (!byString.has(p.string)) byString.set(p.string, null);
      continue;
    }
    const fret = p.fret ?? 0;
    // keep the highest fret per string (a barre plus a finger on the same string)
    const prev = byString.get(p.string);
    byString.set(p.string, prev == null ? fret : Math.max(prev, fret));
  }
  return [1, 2, 3, 4, 5, 6].map((s) => ({ string: s, fret: byString.has(s) ? byString.get(s)! : null }));
}

/** Played strings from low to high pitch (6 -> 1). */
function playedLowToHigh(frets: StringFret[]): StringFret[] {
  return frets.filter((f) => f.fret !== null).sort((a, b) => b.string - a.string);
}

/** Which strings are struck, in order, for a pattern. Each entry is one column. */
function columns(frets: StringFret[], pattern: TabPattern): number[][] {
  const played = playedLowToHigh(frets);
  if (played.length === 0) return [];
  const bass = played[0].string;
  const treble = played.slice(1).map((f) => f.string); // ascending pitch
  if (pattern === "strum") return [played.map((f) => f.string)];
  if (pattern === "arpeggio") {
    // bass, then up the next three strings and back: B 3 2 1 2 3
    const up = treble.slice(0, 3);
    return [[bass], ...up.map((s) => [s]), ...up.slice(0, -1).reverse().map((s) => [s])];
  }
  // travis: alternating bass with treble pinches
  const alt = played.length > 1 ? played[1].string : bass;
  const top = treble.slice(-2);
  return [[bass, ...(top[1] ? [top[1]] : [])], [top[0] ?? bass], [alt], [top[1] ?? top[0] ?? alt],
          [bass], [top[0] ?? bass], [alt, ...(top[1] ? [top[1]] : [])], [top[0] ?? alt]];
}

/**
 * ASCII tab for one chord, six lines high e -> low E, e.g.
 *   e|---0---0---|
 *   B|-----1-----|
 */
export function chordTab(positions: FretPosition[], pattern: TabPattern = "arpeggio"): string[] {
  const frets = stringFrets(positions);
  const cols = columns(frets, pattern);
  const width = Math.max(1, ...frets.map((f) => (f.fret === null ? 1 : String(f.fret).length)));
  const cell = (s: number, col: number[]) => {
    const f = frets[s - 1];
    if (!col.includes(s)) return "-".repeat(width);
    return String(f.fret).padEnd(width, "-");
  };
  return STRING_NAMES.map((name, i) => {
    const s = i + 1;
    if (pattern === "strum") {
      const f = frets[i];
      const mark = f.fret === null ? "x" : String(f.fret);
      return `${name}|--${mark.padEnd(width, "-")}--|`;
    }
    return `${name}|-` + cols.map((col) => cell(s, col)).join("-") + "-|";
  });
}
