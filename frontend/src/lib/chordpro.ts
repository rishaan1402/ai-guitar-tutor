/**
 * ChordPro parsing and chord maths for song sheets.
 *
 * Supports the subset our sheets use:
 *   {title:} {artist:} {key:} {capo:} {tempo:} {time:} {difficulty:} {strumming:} {tuning:}
 *   {comment:}/{c:}, {start_of_verse: Label}/{sov}, chorus/soc, bridge/sob, tab/sot, grid/sog
 *   "[G]words [C]more"  chords over text
 *   "| G . . . | C . D . |"  bar lines ("." holds the chord, "%" repeats the bar)
 */

export type SectionKind = "verse" | "chorus" | "bridge" | "tab" | "grid" | "other";

export interface Segment {
  chord: string | null;
  text: string;
}

export type Line =
  | { type: "lyrics"; segments: Segment[] }
  | { type: "bars"; bars: string[][] }
  | { type: "tab"; text: string }
  | { type: "comment"; text: string }
  | { type: "blank" };

export interface Section {
  kind: SectionKind;
  label: string | null;
  lines: Line[];
}

export interface SongMeta {
  title: string;
  artist: string | null;
  key: string | null;
  capo: number;
  tempo: number | null;
  time: string | null;
  difficulty: string | null;
  strumming: string | null;
  tuning: string | null;
}

export interface Sheet {
  meta: SongMeta;
  sections: Section[];
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

const DIRECTIVE = /^\{\s*([a-zA-Z_]+)\s*(?::\s*(.*?))?\s*\}$/;
const META_ALIASES: Record<string, keyof SongMeta> = {
  title: "title", t: "title",
  artist: "artist", subtitle: "artist", st: "artist",
  key: "key", capo: "capo", tempo: "tempo", time: "time",
  difficulty: "difficulty", strumming: "strumming", tuning: "tuning",
};
const SECTION_SHORT: Record<string, SectionKind> = {
  sov: "verse", soc: "chorus", sob: "bridge", sot: "tab", sog: "grid",
};
const END_SHORT = new Set(["eov", "eoc", "eob", "eot", "eog"]);
const COMMENT_NAMES = new Set(["comment", "c", "ci", "comment_italic", "cb", "comment_box"]);

function sectionLabel(raw: string | undefined): string | null {
  if (!raw) return null;
  // ChordPro 6 also allows {start_of_verse label="Verse 1"}
  const m = raw.match(/label\s*=\s*"([^"]*)"/);
  return (m ? m[1] : raw).trim() || null;
}

function parseLyricLine(line: string): Line {
  const segments: Segment[] = [];
  const re = /\[([^\]]*)\]/g;
  let last = 0;
  let pending: string | null = null;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    const text = line.slice(last, m.index);
    if (text || pending !== null) segments.push({ chord: pending, text });
    pending = m[1].trim();
    last = m.index + m[0].length;
  }
  segments.push({ chord: pending, text: line.slice(last) });
  return { type: "lyrics", segments: segments.filter((s) => s.chord !== null || s.text !== "") };
}

function parseBarLine(line: string): Line {
  const bars = line
    .split("|")
    .map((b) => b.trim())
    .filter((b) => b.length > 0)
    .map((b) => b.split(/\s+/));
  return { type: "bars", bars };
}

export function parseChordPro(text: string): Sheet {
  const meta: SongMeta = {
    title: "", artist: null, key: null, capo: 0, tempo: null,
    time: null, difficulty: null, strumming: null, tuning: null,
  };
  const sections: Section[] = [];
  let current: Section | null = null;

  const open = (kind: SectionKind, label: string | null) => {
    current = { kind, label, lines: [] };
    sections.push(current);
  };
  const push = (line: Line) => {
    if (!current) open("other", null);
    const lines = current!.lines;
    // Collapse runs of blank lines
    if (line.type === "blank" && (lines.length === 0 || lines[lines.length - 1].type === "blank")) return;
    lines.push(line);
  };
  const close = () => {
    if (current) {
      while (current.lines.length && current.lines[current.lines.length - 1].type === "blank") current.lines.pop();
    }
    current = null;
  };

  for (const rawLine of text.replace(/\r\n?/g, "\n").split("\n")) {
    const line = rawLine.replace(/\s+$/, "");
    const trimmed = line.trim();
    const d = trimmed.match(DIRECTIVE);

    if (d) {
      const name = d[1].toLowerCase();
      const value = d[2];
      const metaKey = META_ALIASES[name];
      if (metaKey) {
        if (value === undefined) continue;
        if (metaKey === "capo") meta.capo = Math.max(0, Math.min(11, parseInt(value, 10) || 0));
        else if (metaKey === "tempo") meta.tempo = parseInt(value, 10) || null;
        else if (metaKey === "title") meta.title = value;
        else (meta as unknown as Record<string, string | null>)[metaKey] = value || null;
        continue;
      }
      if (COMMENT_NAMES.has(name)) {
        if (value) push({ type: "comment", text: value });
        continue;
      }
      const start = name.startsWith("start_of_") ? name.slice(9) : null;
      const kind = (start as SectionKind | null) ?? SECTION_SHORT[name];
      if (kind) {
        close();
        open(["verse", "chorus", "bridge", "tab", "grid"].includes(kind) ? kind : "other", sectionLabel(value));
        continue;
      }
      if (name.startsWith("end_of_") || END_SHORT.has(name)) {
        close();
        continue;
      }
      continue; // unknown directive: ignore, like other ChordPro readers
    }

    const inTab = (current as Section | null)?.kind === "tab";
    if (inTab) {
      push(trimmed ? { type: "tab", text: line } : { type: "blank" });
    } else if (!trimmed) {
      push({ type: "blank" });
    } else if (trimmed.startsWith("#")) {
      continue; // ChordPro comment line
    } else if (trimmed.startsWith("|")) {
      push(parseBarLine(trimmed));
    } else {
      push(parseLyricLine(line));
    }
  }
  close();
  return { meta, sections: sections.filter((s) => s.lines.length > 0) };
}

// ---------------------------------------------------------------------------
// Chords
// ---------------------------------------------------------------------------

const SHARPS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLATS = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
const CHORD = /^([A-G])([#b]?)([^/]*)(?:\/([A-G][#b]?))?$/;

export interface ParsedChord {
  root: string;
  quality: string;
  bass: string | null;
}

function noteIndex(note: string): number {
  const i = SHARPS.indexOf(note);
  return i >= 0 ? i : FLATS.indexOf(note);
}

export function parseChord(symbol: string): ParsedChord | null {
  const m = symbol.trim().match(CHORD);
  if (!m) return null;
  return { root: m[1] + m[2], quality: m[3], bass: m[4] ?? null };
}

function transposeNote(note: string, steps: number, flats: boolean): string {
  const i = noteIndex(note);
  if (i < 0) return note;
  const j = (((i + steps) % 12) + 12) % 12;
  return (flats ? FLATS : SHARPS)[j];
}

function formatChord(c: ParsedChord): string {
  return c.root + c.quality + (c.bass ? `/${c.bass}` : "");
}

/** Shift a chord by `steps` semitones. Non-chords ("N.C.", ".", "%") pass through. */
export function transposeChord(symbol: string, steps: number, flats = false): string {
  const c = parseChord(symbol);
  if (!c) return symbol;
  if (steps === 0 && !flats) return symbol;
  return formatChord({
    root: transposeNote(c.root, steps, flats),
    quality: c.quality,
    bass: c.bass ? transposeNote(c.bass, steps, flats) : null,
  });
}

function isMinorQuality(q: string): boolean {
  return /^(m(?!aj)|min|-)/.test(q);
}

/** Reduce a chord to the plain major/minor triad a beginner can play (Cadd9 -> C, Am7 -> Am, D/F# -> D). */
export function simplifyChord(symbol: string): string {
  const c = parseChord(symbol);
  if (!c) return symbol;
  if (/^(dim|o|ø|m7b5)/.test(c.quality)) return symbol; // no simpler shape that keeps the sound
  return c.root + (isMinorQuality(c.quality) ? "m" : "");
}

const QUALITY_KEYS: [RegExp, string][] = [
  [/^(maj7|M7|Δ7?|major7)$/, "major7"],
  [/^(m7|min7|-7|minor7)$/, "minor7"],
  [/^(7|dom7)$/, "dominant7"],
  [/^(m7b5|m7-5|ø7?|half_dim7)$/, "half_dim7"],
  [/^(m|min|-|minor)$/, "minor"],
  [/^(5)$/, "power"],
  [/^(|maj|M|major)$/, "major"],
];

/** Map a chord symbol to the app's lesson key (e.g. "F#m" -> "F#_minor"), or null if we have no lesson. */
export function toAppChordKey(symbol: string): string | null {
  const c = parseChord(symbol);
  if (!c) return null;
  const root = SHARPS[noteIndex(c.root)];
  for (const [re, key] of QUALITY_KEYS) {
    if (re.test(c.quality)) return `${root}_${key}`;
  }
  return null;
}

const FLAT_KEYS = new Set(["F", "Bb", "Eb", "Ab", "Db", "Gb", "Dm", "Gm", "Cm", "Fm", "Bbm", "Ebm"]);

/** Whether a key is conventionally written with flats. */
export function keyPrefersFlats(key: string | null): boolean {
  if (!key) return false;
  const k = key.trim().replace(/\s*(major|maj)$/i, "").replace(/\s*minor$/i, "m");
  return FLAT_KEYS.has(k);
}

// ---------------------------------------------------------------------------
// Whole-sheet transforms
// ---------------------------------------------------------------------------

export interface DisplayOptions {
  /** Semitones to move the sounding pitch. */
  transpose: number;
  /** Capo the player will use. Shapes are shifted so the pitch stays put. */
  capo: number;
  flats: boolean;
  simplify: boolean;
}

/** Semitone shift applied to every written chord for these options. */
export function shapeShift(meta: SongMeta, opts: DisplayOptions): number {
  // Written chords are shapes for the sheet's own capo. Keep the sounding pitch
  // (plus `transpose`) while the player uses `opts.capo`.
  return opts.transpose + meta.capo - opts.capo;
}

export function displayChord(symbol: string, meta: SongMeta, opts: DisplayOptions): string {
  const base = opts.simplify ? simplifyChord(symbol) : symbol;
  return transposeChord(base, shapeShift(meta, opts), opts.flats);
}

export function mapChords(sheet: Sheet, fn: (chord: string) => string): Sheet {
  const isBeatMark = (t: string) => t === "." || t === "%" || t === "/";
  return {
    meta: sheet.meta,
    sections: sheet.sections.map((s) => ({
      ...s,
      lines: s.lines.map((line): Line => {
        if (line.type === "lyrics") {
          return { type: "lyrics", segments: line.segments.map((seg) => ({ ...seg, chord: seg.chord && fn(seg.chord) })) };
        }
        if (line.type === "bars") {
          return { type: "bars", bars: line.bars.map((bar) => bar.map((t) => (isBeatMark(t) ? t : fn(t)))) };
        }
        return line;
      }),
    })),
  };
}

/** Distinct chord symbols in order of first appearance. */
export function chordsInSheet(sheet: Sheet): string[] {
  const seen: string[] = [];
  const add = (c: string | null) => {
    if (c && parseChord(c) && !seen.includes(c)) seen.push(c);
  };
  for (const s of sheet.sections) {
    for (const line of s.lines) {
      if (line.type === "lyrics") line.segments.forEach((seg) => add(seg.chord));
      if (line.type === "bars") line.bars.forEach((bar) => bar.forEach(add));
    }
  }
  return seen;
}
