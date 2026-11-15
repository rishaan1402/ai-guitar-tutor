/**
 * Turn a chord chart (ChordPro) into Grooves you can play along to:
 * one per section, plus the whole song, optionally simplified to chords you know.
 */
import type { Section, Sheet } from "../chordpro";
import { parseChord } from "../chordpro";
import { BEATS_PER_BAR, type Groove, type GrooveStyle } from "./groove";
import { chordNotes } from "./theory";

const BEAT_MARKS = new Set([".", "%", "/", "-"]);

/** Bars of a section: bar lines as written; lyric lines give one chord per bar. */
export function sectionBars(section: Section): string[][] {
  const bars: string[][] = [];
  let last: string | null = null;
  for (const line of section.lines) {
    if (line.type === "bars") {
      for (const bar of line.bars) {
        if (bar.length === 1 && bar[0] === "%" && bars.length) {
          bars.push(bars[bars.length - 1].slice());
          continue;
        }
        const chords = bar.filter((t) => !BEAT_MARKS.has(t) && parseChord(t));
        if (!chords.length) {
          if (last) bars.push([last]);
          continue;
        }
        const two = chords.slice(0, 2);
        bars.push(two);
        last = two[two.length - 1];
      }
    } else if (line.type === "lyrics") {
      for (const seg of line.segments) {
        if (seg.chord && parseChord(seg.chord)) {
          bars.push([seg.chord]);
          last = seg.chord;
        }
      }
    }
  }
  return bars.filter((b) => b.every((c) => chordNotes(base(c)) !== null));
}

/** Drop what the highway can't voice (slash bass, add9, sus...) to a playable chord. */
export function base(symbol: string): string {
  const c = parseChord(symbol);
  if (!c) return symbol;
  const q = c.quality;
  const keep = ["", "m", "7", "maj7", "m7", "m7b5", "5", "dim", "aug", "6", "m6", "sus2", "sus4", "add9"];
  return c.root + (keep.includes(q) ? q : q.startsWith("m") && !q.startsWith("maj") ? "m" : "");
}

const TRIAD = (s: string) => {
  const c = parseChord(s);
  if (!c) return s;
  return c.root + (["m", "m7", "m7b5", "m6"].includes(c.quality) || (c.quality.startsWith("m") && !c.quality.startsWith("maj")) ? "m" : "");
};

/** The closest chord you know for `symbol` (itself if known or nothing close). */
export function easyChord(symbol: string, known: Set<string>): string {
  const b = base(symbol);
  if (known.has(b)) return b;
  const t = TRIAD(b);
  if (known.has(t)) return t;
  const target = new Set(chordNotes(t)?.pcs ?? []);
  let best = t;
  let overlap = 1;
  for (const k of Array.from(known)) {
    const n = (chordNotes(k)?.pcs ?? []).filter((p) => target.has(p)).length;
    if (n > overlap) {
      best = k;
      overlap = n;
    }
  }
  return overlap >= 2 ? best : t;
}

/** "D DU UDU" / "D-DU-UDU" style text -> 8 eighth-note slots. */
export function strumFrom(text: string | null | undefined): string {
  // "D - D U - U D U": one symbol per eighth note, separated by spaces
  const tokens = (text ?? "").trim().toUpperCase().split(/\s+/);
  if (tokens.length === 8 && tokens.every((t) => /^[DU.\-X]$/.test(t))) {
    return tokens.map((t) => (t === "D" || t === "U" ? t : ".")).join("");
  }
  // "D DU UDU": a space stands for the missing eighth
  const t = (text ?? "").toUpperCase().replace(/[^DU\s.\-x]/gi, "");
  const slots = t.replace(/[\s\-x]/gi, ".").slice(0, 8).padEnd(8, ".");
  return /D/.test(slots) ? slots : "D.DU.UDU";
}

export interface SongGroove extends Groove {
  source: string;
  mode?: "wait" | "play" | "follow";
}

export function songGrooves(sheet: Sheet, opts: { known?: Set<string>; easy?: boolean } = {}): { label: string; groove: SongGroove; changed: string[] }[] {
  const bpm = Math.max(50, Math.min(140, sheet.meta.tempo ?? 80));
  const waltz = /^3\s*\/\s*4$/.test(sheet.meta.time ?? "") || /^6\s*\/\s*8$/.test(sheet.meta.time ?? "");
  const beatsPerBar = waltz ? 3 : 4;
  const strum = waltz ? strumFrom(sheet.meta.strumming).slice(0, 6) : strumFrom(sheet.meta.strumming);
  const style: GrooveStyle = bpm >= 110 ? "rock" : bpm <= 72 ? "ballad" : "pop";
  const out: { label: string; groove: SongGroove; changed: string[] }[] = [];
  const all: string[][] = [];
  const counts = new Map<string, number>();
  sheet.sections.forEach((sec, i) => {
    let bars = sectionBars(sec).map((b) => b.map(base));
    if (!bars.length) return;
    const changed = new Set<string>();
    if (opts.easy && opts.known?.size) {
      bars = bars.map((b) =>
        b.map((c) => {
          const e = easyChord(c, opts.known!);
          if (e !== c) changed.add(`${c}→${e}`);
          return e;
        }),
      );
    }
    all.push(...bars);
    const name = sec.label || sec.kind;
    const n = (counts.get(name) ?? 0) + 1;
    counts.set(name, n);
    const label = n > 1 ? `${name} ${n}` : name;
    out.push({
      label: label.charAt(0).toUpperCase() + label.slice(1),
      changed: Array.from(changed),
      groove: {
        id: `song-${i}`,
        title: `${sheet.meta.title || "Song"}: ${label}`.slice(0, 60),
        style, bpm, bars: bars.slice(0, 32), strum, loops: bars.length <= 4 ? 4 : bars.length <= 8 ? 2 : 1,
        source: "song", mode: "follow", beatsPerBar,
      },
    });
  });
  if (all.length && out.length > 1) {
    out.unshift({
      label: "Whole song",
      changed: Array.from(new Set(out.flatMap((o) => o.changed))),
      groove: { id: "song-all", title: (sheet.meta.title || "Song").slice(0, 60), style, bpm, bars: all.slice(0, 64), strum, loops: 1, source: "song", mode: "follow", beatsPerBar },
    });
  }
  // a song needs at least one chord change to play along to
  return out.filter((o) => new Set(o.groove.bars.flat()).size > 1 || o.groove.bars.some((b) => b.length > 1));
}

export { BEATS_PER_BAR };
