/**
 * Find playable guitar shapes for any chord.
 *
 * Every candidate is checked against the chord's notes: it may only sound
 * chord tones, must include every required tone, and its lowest note must be
 * the root (or the slash-chord bass). Then it must be playable: at most four
 * fingers (an index-finger barre counts as one), a stretch of at most four
 * frets, and muted strings only on the bass side (or the top e string).
 * Survivors are scored for ease: low on the neck, open strings, fewer
 * fingers, no barre, fuller sound.
 */
import type { ChordFingering, FretPosition } from "../api";
import { noteNameOf, parseSymbol, type ChordSpec } from "./quality";

/** Open-string MIDI notes, indexed by string number (6 = low E ... 1 = high e). */
const OPEN: Record<number, number> = { 6: 40, 5: 45, 4: 50, 3: 55, 2: 59, 1: 64 };
const STRINGS = [6, 5, 4, 3, 2, 1];
const MUTE = -1;

export interface Voicing {
  /** Frets for strings 6..1; -1 = muted, 0 = open. */
  frets: number[];
  /** Fingers for strings 6..1 (0 = none). */
  fingers: number[];
  /** Index-finger barre: fret and the strings it covers, or null. */
  barre: { fret: number; from: number; to: number } | null;
  score: number;
}

const midiOf = (stringIdx: number, fret: number) => OPEN[STRINGS[stringIdx]] + fret;

/** Fingers for a shape; null if it needs more than four. */
export function assignFingers(frets: number[]): { fingers: number[]; barre: Voicing["barre"] } | null {
  const fretted = frets.map((f, i) => ({ f, i })).filter((x) => x.f > 0);
  const fingers = frets.map(() => 0);
  if (!fretted.length) return { fingers, barre: null };
  const minF = Math.min(...fretted.map((x) => x.f));
  const atMin = fretted.filter((x) => x.f === minF);
  let barre: Voicing["barre"] = null;
  let next = 1;
  let rest = fretted;
  if (atMin.length >= 2) {
    // a barre covers from the thickest to the thinnest string at the lowest fret,
    // and nothing in between may be open or muted
    const lo = Math.min(...atMin.map((x) => x.i)), hi = Math.max(...atMin.map((x) => x.i));
    const clear = frets.slice(lo, hi + 1).every((f) => f >= minF);
    const plain = fretted.length <= 4; // enough fingers without a barre?
    if (clear && !plain) {
      barre = { fret: minF, from: STRINGS[lo], to: STRINGS[hi] };
      atMin.forEach((x) => (fingers[x.i] = 1));
      rest = fretted.filter((x) => x.f !== minF);
      next = 2;
    }
  }
  // one finger per note, lowest fret first; on the same fret, thicker string first
  const order = [...rest].sort((a, b) => a.f - b.f || a.i - b.i);
  if (next - 1 + order.length > 4) {
    // too many notes: flatten one finger across neighbouring strings on the same fret
    // (the ring-finger barre of C9 x32333 or A x02220-style shapes up the neck)
    const groups = new Map<number, number[]>();
    for (const x of order) groups.set(x.f, [...(groups.get(x.f) ?? []), x.i]);
    let best: number[] | null = null;
    for (const idx of Array.from(groups.values())) {
      // split into runs of neighbouring strings
      const sorted = [...idx].sort((x, y) => x - y);
      let run: number[] = [];
      for (const i of [...sorted, -9]) {
        if (run.length && i === run[run.length - 1] + 1) run.push(i);
        else {
          if (run.length >= 2 && (!best || run.length > best.length)) best = run;
          run = [i];
        }
      }
    }
    if (!best) return null;
    const grouped = new Set(best);
    const singles = order.filter((x) => !grouped.has(x.i));
    const groupFret = frets[best[0]];
    let placed = false;
    for (const x of singles) {
      if (!placed && x.f > groupFret) {
        if (next > 4) return null;
        best.forEach((i) => (fingers[i] = next));
        next++;
        placed = true;
      }
      if (next > 4) return null;
      fingers[x.i] = next++;
    }
    if (!placed) {
      if (next > 4) return null;
      best.forEach((i) => (fingers[i] = next));
    }
    return { fingers, barre };
  }
  for (const x of order) fingers[x.i] = next++;
  return { fingers, barre };
}

function evaluate(frets: number[], spec: ChordSpec): Voicing | null {
  const played = frets.map((f, i) => (f >= 0 ? i : -1)).filter((i) => i >= 0);
  const minStrings = spec.quality.tones.length <= 2 ? 2 : 3;
  if (played.length < minStrings) return null;
  // muted strings: a run on the bass side, plus optionally the top e string
  const firstPlayed = played[0];
  for (let i = firstPlayed; i < 6; i++) if (frets[i] < 0 && i !== 5) return null;
  const pcs = new Set<number>();
  for (const i of played) {
    const pc = midiOf(i, frets[i]) % 12;
    if (!spec.pcs.includes(pc)) return null;
    pcs.add(pc);
  }
  for (const r of spec.required) if (!pcs.has(r)) return null;
  // the lowest pitch, not the thickest string: an open A sounds below the low E at fret 8
  const bassPc = Math.min(...played.map((i) => midiOf(i, frets[i]))) % 12;
  if (bassPc !== (spec.bass ?? spec.root)) return null;
  const fretted = played.filter((i) => frets[i] > 0).map((i) => frets[i]);
  const span = fretted.length ? Math.max(...fretted) - Math.min(...fretted) : 0;
  if (span > 3) return null;
  const fing = assignFingers(frets);
  if (!fing) return null;
  const low = fretted.length ? Math.min(...fretted) : 0;
  const opens = played.filter((i) => frets[i] === 0).length;
  const missingOptional = spec.pcs.filter((p) => !pcs.has(p)).length;
  const fingerCount = new Set(fing.fingers.filter((f) => f > 0)).size;
  const high = fretted.length ? Math.max(...fretted) : 0;
  const score =
    low * 1.6 + // low on the neck is easier to find
    fingerCount * 1.4 +
    span * 0.8 +
    (6 - played.length) * 2.2 + // fuller chords sound better
    (played.length < 4 && spec.quality.tones.length >= 3 ? 4 : 0) +
    (fing.barre ? 2.5 + (fing.barre.from - fing.barre.to) * 0.4 : 0) +
    missingOptional * 1.2 +
    (frets[5] < 0 ? 3 : 0) + // a muted top string is awkward and sounds thin
    (high >= 4 ? opens * 2 : -Math.min(opens, 3) * 0.3); // open strings belong to open-position shapes
  return { frets, fingers: fing.fingers, barre: fing.barre, score };
}

/** All playable shapes, easiest first. */
export function findVoicings(spec: ChordSpec, maxFret = 14): Voicing[] {
  const seen = new Set<string>();
  const out: Voicing[] = [];
  for (let start = 0; start <= maxFret - 3; start++) {
    const window = start === 0 ? [1, 2, 3, 4] : [start, start + 1, start + 2, start + 3];
    const options = [MUTE, 0, ...window];
    const frets = [0, 0, 0, 0, 0, 0];
    const walk = (s: number) => {
      if (s === 6) {
        const key = frets.join(",");
        if (seen.has(key)) return;
        seen.add(key);
        const v = evaluate([...frets], spec);
        if (v) out.push(v);
        return;
      }
      for (const o of options) {
        // prune: once a string plays, every thicker string must already be decided as bass or mute;
        // a note on this string must be a chord tone
        if (o >= 0 && !spec.pcs.includes(midiOf(s, o) % 12)) continue;
        frets[s] = o;
        walk(s + 1);
      }
    };
    walk(0);
  }
  return out.sort((a, b) => a.score - b.score);
}

/**
 * The shapes guitarists actually teach for common song chords (strings 6..1). Each is
 * still checked by the same rules as a search result before it's used.
 */
export const COMMON: Record<string, string> = {
  Cadd9: "x32033", Gadd9: "300203", Aadd9: "x02420", Eadd9: "024100",
  Dsus2: "xx0230", Dsus4: "xx0233", Asus2: "x02200", Asus4: "x02230", Esus4: "022200", Csus2: "x30033", Csus4: "x33011", Gsus4: "330013",
  Em7: "022030", Am7: "x02010", Dm7: "xx0211", Bm7: "x20202", "F#m7": "242222", Cmaj7: "x32000", Gmaj7: "320002", Fmaj7: "xx3210", Amaj7: "x02120", Dmaj7: "xx0222", Emaj7: "021100",
  C7: "x32310", G7: "320001", D7: "xx0212", A7: "x02020", E7: "020100", B7: "x21202",
  E7sus4: "020200", A7sus4: "x02030", D7sus4: "xx0213",
  C6: "x32210", G6: "320000", A6: "x02222", D6: "xx0202", E6: "022120", Am6: "x02212", Dm6: "xx0201", Em6: "022020",
  "G/B": "x20033", "C/G": "332010", "C/E": "032010", "D/F#": "200232", "A/C#": "x42220", "G/D": "xx0003", "F/C": "x33211", "Am/G": "302210", "Em/D": "xx0000",
  Bm: "x24432", F: "133211", Bb: "x13331", Eb: "x65343", Ab: "466544", Db: "x46664", "F#": "244322",
  "C#m": "x46654", "F#m": "244222", Gm: "355333", Cm: "x35543", Fm: "133111", Bbm: "x13321", "G#m": "466444", "D#m": "x68876", Ebm: "x68876",
  Am9: "x02413", Em9: "022032", E9: "020102", A9: "x02423", C9: "x32333", G9: "300201",
  "G#m7": "464444", Cm7: "x35343", Gm7: "353333", "C#m7": "x46454", Ab7: "464544", Bb7: "x13131", Bbmaj7: "x13231", Ebm7: "x68676",
  Bdim: "x2343x", Bdim7: "x2313x", Bm7b5: "x2323x", Caug: "x32110", Eaug: "032110",
};

export function fromTable(spec: ChordSpec): Voicing | null {
  const t = COMMON[spec.symbol.replace(/\s+/g, "")];
  if (!t || t.length !== 6) return null;
  const frets = t.split("").map((c) => (c === "x" ? MUTE : Number(c)));
  return evaluate(frets, spec);
}

/** The shape to teach first, plus a barre shape further up for players moving on. */
export function bestVoicings(spec: ChordSpec): { first: Voicing; alt: Voicing | null } | null {
  const all = findVoicings(spec);
  if (!all.length) return null;
  const first = fromTable(spec) ?? all[0];
  const firstLow = Math.min(...first.frets.filter((f) => f > 0), 99);
  const alt = all.find((v) => v !== first && v.frets.every((f) => f !== 0) && Math.min(...v.frets.filter((f) => f > 0)) !== firstLow) ?? null;
  return { first, alt };
}

function toPositions(v: Voicing, spec: ChordSpec): FretPosition[] {
  // name each sounding note as the chord spells it
  const name = (pc: number) => spec.noteNames[spec.pcs.indexOf(pc)] ?? noteNameOf(pc);
  return STRINGS.map((string, i) =>
    v.frets[i] < 0
      ? { string, action: "mute" }
      : { string, fret: v.frets[i], note: name(midiOf(i, v.frets[i]) % 12), ...(v.fingers[i] ? { finger: v.fingers[i] } : {}) },
  );
}

/** A complete fingering for any chord symbol, in the same shape the library uses. Null if unreadable or unplayable. */
export function buildFingering(symbol: string): ChordFingering | null {
  const spec = parseSymbol(symbol);
  if (!spec) return null;
  const best = bestVoicings(spec);
  if (!best) return null;
  return {
    chord: spec.symbol,
    display_name: spec.symbol,
    root: spec.rootName,
    quality: spec.quality.name,
    notes: spec.noteNames,
    positions: toPositions(best.first, spec),
    ...(best.alt ? { alt_positions: toPositions(best.alt, spec) } : {}),
  };
}

/** "x32010" style string for a voicing (6 to 1). */
export function fretString(frets: number[]): string {
  return frets.map((f) => (f < 0 ? "x" : f > 9 ? `(${f})` : String(f))).join("");
}
