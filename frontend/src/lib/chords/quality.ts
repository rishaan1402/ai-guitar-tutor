/**
 * Chord vocabulary: every chord type the app understands, the notes it
 * contains (semitones above the root), and which of them a guitarist may
 * leave out. Used to read any chord symbol, build shapes for it and hear it.
 */

export interface Quality {
  /** Canonical suffix, e.g. "m7b5". "" is major. */
  id: string;
  /** Words for people: "minor 7 flat 5". */
  name: string;
  /** All chord tones, semitones above the root (0 first). */
  tones: number[];
  /** Tones a voicing may drop (usually the 5th in bigger chords). */
  optional: number[];
  /** Other ways the suffix is written. */
  aliases: string[];
}

const q = (id: string, name: string, tones: number[], optional: number[] = [], aliases: string[] = []): Quality => ({ id, name, tones, optional, aliases });

export const QUALITIES: Quality[] = [
  q("", "major", [0, 4, 7], [], ["maj", "M", "major"]),
  q("m", "minor", [0, 3, 7], [], ["min", "-", "minor"]),
  q("5", "power chord", [0, 7], [], []),
  q("dim", "diminished", [0, 3, 6], [], ["°", "o", "min(b5)", "mb5"]),
  q("aug", "augmented", [0, 4, 8], [], ["+", "(#5)", "#5"]),
  q("sus2", "suspended 2nd", [0, 2, 7], [], ["2sus"]),
  q("sus4", "suspended 4th", [0, 5, 7], [], ["sus", "4"]),
  q("6", "major 6th", [0, 4, 7, 9], [7], ["maj6", "M6", "add6"]),
  q("m6", "minor 6th", [0, 3, 7, 9], [7], ["min6", "-6"]),
  q("69", "6/9", [0, 4, 7, 9, 2], [7], ["6add9", "6/9"]),
  q("add9", "add 9", [0, 4, 7, 2], [], ["add2", "2", "(add9)"]),
  q("madd9", "minor add 9", [0, 3, 7, 2], [], ["m(add9)", "madd2", "m2", "min(add9)"]),
  q("7", "dominant 7th", [0, 4, 7, 10], [7], ["dom7", "dom"]),
  q("maj7", "major 7th", [0, 4, 7, 11], [7], ["M7", "Δ", "Δ7", "major7", "ma7"]),
  q("m7", "minor 7th", [0, 3, 7, 10], [7], ["min7", "-7", "minor7", "mi7"]),
  q("m7b5", "half-diminished (minor 7 flat 5)", [0, 3, 6, 10], [], ["ø", "ø7", "m7-5", "min7b5", "-7b5", "half_dim7"]),
  q("dim7", "diminished 7th", [0, 3, 6, 9], [], ["°7", "o7"]),
  q("mmaj7", "minor-major 7th", [0, 3, 7, 11], [7], ["m(maj7)", "mM7", "m/maj7", "minmaj7", "-maj7", "m(M7)"]),
  q("7sus4", "dominant 7 suspended 4th", [0, 5, 7, 10], [7], ["7sus", "sus7", "7(sus4)"]),
  q("7sus2", "dominant 7 suspended 2nd", [0, 2, 7, 10], [7], []),
  q("aug7", "augmented 7th", [0, 4, 8, 10], [], ["7#5", "+7", "7(#5)", "7+"]),
  q("9", "dominant 9th", [0, 4, 7, 10, 2], [7], ["dom9"]),
  q("maj9", "major 9th", [0, 4, 7, 11, 2], [7], ["M9", "Δ9"]),
  q("m9", "minor 9th", [0, 3, 7, 10, 2], [7], ["min9", "-9"]),
  q("add11", "add 11", [0, 4, 7, 5], [7], ["add4"]),
  q("11", "dominant 11th", [0, 7, 10, 2, 5], [7, 2], []),
  q("m11", "minor 11th", [0, 3, 7, 10, 2, 5], [7, 2], ["min11", "-11"]),
  q("13", "dominant 13th", [0, 4, 7, 10, 2, 9], [7, 2], []),
  q("7b9", "dominant 7 flat 9", [0, 4, 7, 10, 1], [7], ["7(b9)", "7-9"]),
  q("7#9", "dominant 7 sharp 9", [0, 4, 7, 10, 3], [7], ["7(#9)", "7+9"]),
];

const BY_SUFFIX = new Map<string, Quality>();
for (const qu of QUALITIES) {
  BY_SUFFIX.set(qu.id, qu);
  for (const a of qu.aliases) if (!BY_SUFFIX.has(a)) BY_SUFFIX.set(a, qu);
}

/** The chord type for a suffix ("m7", "min7", "-7"...), or undefined if unknown. */
export function qualityFor(suffix: string): Quality | undefined {
  const s = suffix.replace(/\s+/g, "");
  const exact = BY_SUFFIX.get(s);
  if (exact) return exact;
  // "Maj7", "SUS4", "Dim": case only matters for a lone m / M, so only fold whole words
  return /^(maj|min|sus|add|dim|aug)/i.test(s) ? BY_SUFFIX.get(s.toLowerCase()) : undefined;
}

const SHARPS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLATS = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
const PC: Record<string, number> = {
  C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11, Cb: 11, Fb: 4, "E#": 5, "B#": 0,
};

export interface ChordSpec {
  /** The symbol as written. */
  symbol: string;
  root: number;
  rootName: string;
  quality: Quality;
  /** Slash-chord bass note (pitch class), or null. */
  bass: number | null;
  bassName: string | null;
  /** Chord tones as pitch classes, root first (bass added when it's not a chord tone). */
  pcs: number[];
  /** Pitch classes a voicing must contain. */
  required: number[];
  /** Note names, spelled with flats when the root is flat. */
  noteNames: string[];
}

/** Read any chord symbol: "F#m7b5", "Bb/D", "C6/9", "Asus", "E7#9"... */
export function parseSymbol(symbol: string): ChordSpec | null {
  const raw = symbol.trim().replace(/♯/g, "#").replace(/♭/g, "b").replace(/^\((.*)\)$/, "$1");
  const m = /^([A-G])([#b]?)(.*?)(?:\/([A-G][#b]?))?$/.exec(raw.replace(/6\/9/, "69"));
  if (!m) return null;
  const rootName = m[1] + m[2];
  const root = PC[rootName];
  const quality = qualityFor(m[3]);
  if (root === undefined || !quality) return null;
  const bassName = m[4] ?? null;
  const bass = bassName ? PC[bassName] ?? null : null;
  if (bassName && bass === null) return null;
  const pcs = quality.tones.map((t) => (root + t) % 12);
  // spell each note the way it's written: flattened intervals (b3 b5 b7 b9) with flats,
  // raised ones (#5 #9) and sharp-key roots with sharps
  const flatKey = m[2] === "b" || rootName === "F";
  const spell = (t: number): string => {
    const pc = (root + t) % 12;
    if (m[2] === "#") return SHARPS[pc];
    if ((t === 8 && /aug|#5/.test(quality.id)) || (t === 3 && quality.id.includes("#9"))) return SHARPS[pc];
    if ([1, 3, 6, 8, 10].includes(t)) return FLATS[pc];
    return (flatKey ? FLATS : SHARPS)[pc];
  };
  const noteNames = quality.tones.map(spell);
  if (bassName && !quality.tones.some((t) => (root + t) % 12 === bass)) noteNames.push(bassName);
  if (bass !== null && !pcs.includes(bass)) pcs.push(bass);
  const required = quality.tones.filter((t) => !quality.optional.includes(t)).map((t) => (root + t) % 12);
  if (bass !== null && !required.includes(bass)) required.push(bass);
  return {
    symbol: symbol.trim(),
    root,
    rootName,
    quality,
    bass,
    bassName,
    pcs,
    required,
    noteNames,
  };
}

export const noteNameOf = (pc: number, flats = false) => (flats ? FLATS : SHARPS)[((pc % 12) + 12) % 12];

/** "F#m7b5" -> "F# half-diminished (minor 7 flat 5)"; slash chords say "over D". */
export function describe(spec: ChordSpec): string {
  const base = `${spec.rootName} ${spec.quality.name}`;
  return spec.bassName ? `${base} over ${spec.bassName}` : base;
}
