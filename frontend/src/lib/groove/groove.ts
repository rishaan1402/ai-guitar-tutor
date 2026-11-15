/**
 * A Groove: a short loop of chords with a strum pattern and a backing band,
 * played on the highway. Phase 2 generates these from the student's profile;
 * the presets below are hand-written starters.
 */
export type GrooveStyle = "pop" | "ballad" | "rock" | "folk";

export interface Groove {
  /** "chords" (default) or "lead": single notes written string:fret, e.g. "2:3". */
  kind?: "chords" | "lead";
  id: string;
  title: string;
  style: GrooveStyle;
  bpm: number;
  /** Chords: one or two per 4/4 bar (split 2 + 2 beats). Lead: up to four notes per bar; "-" holds the previous note. */
  bars: string[][];
  /** Eight eighth-note slots per bar: D (down), U (up), . (rest). */
  strum: string;
  /** The change this Groove is built to practise. */
  focus?: [string, string];
  tip?: string;
  /** Times through the loop. */
  loops: number;
}

export interface Segment {
  chord: string;
  /** Start beat from the top of the Groove (all loops laid end to end). */
  start: number;
  beats: number;
}

export interface Change {
  /** Index of this change across the whole run. */
  i: number;
  beat: number;
  from: string;
  to: string;
  focus: boolean;
}

export const BEATS_PER_BAR = 4;

export function timeline(g: Groove): { segments: Segment[]; changes: Change[]; totalBeats: number } {
  const segments: Segment[] = [];
  let beat = 0;
  for (let loop = 0; loop < g.loops; loop++) {
    for (const bar of g.bars) {
      const each = BEATS_PER_BAR / bar.length;
      for (const chord of bar) {
        const last = segments[segments.length - 1];
        // a held chord is one box; in lead "-" holds and repeated notes are separate plucks
        if (last && (chord === "-" || (g.kind !== "lead" && last.chord === chord))) last.beats += each;
        else if (chord !== "-") segments.push({ chord, start: beat, beats: each });
        beat += each;
      }
    }
  }
  const changes: Change[] = [];
  for (let k = 1; k < segments.length; k++) {
    const from = segments[k - 1].chord, to = segments[k].chord;
    if (from === to && g.kind !== "lead") continue;
    changes.push({
      i: changes.length,
      beat: segments[k].start,
      from,
      to,
      focus: !!g.focus && from === g.focus[0] && to === g.focus[1],
    });
  }
  return { segments, changes, totalBeats: beat };
}

/** Eighth-note strum slots for one bar, e.g. "D.DU.UDU" -> ["D",".","D","U",".","U","D","U"]. */
export function strumSlots(pattern: string): string[] {
  const s = pattern.replace(/\s+/g, "").toUpperCase().slice(0, 8).split("");
  while (s.length < 8) s.push(".");
  return s;
}

export function chordsIn(g: Groove): string[] {
  return Array.from(new Set(g.bars.flat().filter((c) => c !== "-")));
}

export const PRESET_GROOVES: Groove[] = [
  {
    id: "first-groove",
    title: "First Groove",
    style: "ballad",
    bpm: 66,
    bars: [["Em"], ["Em"], ["Am"], ["Am"]],
    strum: "D...D...",
    focus: ["Em", "Am"],
    tip: "Em to Am: your 2nd and 3rd fingers move down one string together, then add your 1st.",
    loops: 2,
  },
  {
    id: "late-night-g",
    title: "Late Night in G",
    style: "pop",
    bpm: 76,
    bars: [["G"], ["C"], ["Em"], ["D"]],
    strum: "D.D.D.DU",
    focus: ["G", "C"],
    tip: "G to C: lead with your ring finger, it moves the least.",
    loops: 2,
  },
  {
    id: "campfire-d",
    title: "Campfire in D",
    style: "folk",
    bpm: 80,
    bars: [["D"], ["A"], ["G"], ["D", "A"]],
    strum: "D.DU.UDU",
    focus: ["A", "G"],
    tip: "A to G: lift all three fingers together and land the G from the bass string up.",
    loops: 2,
  },
  {
    id: "sunset-c",
    title: "Sunset Loop in C",
    style: "pop",
    bpm: 72,
    bars: [["C"], ["Am"], ["Em"], ["G"]],
    strum: "D.DU.UDU",
    focus: ["C", "Am"],
    tip: "C to Am: only your ring finger moves, to the 3rd string.",
    loops: 2,
  },
];

export function presetById(id: string | null | undefined, extra: Groove[] = []): Groove | undefined {
  return [...PRESET_GROOVES, ...extra].find((g) => g.id === id);
}
