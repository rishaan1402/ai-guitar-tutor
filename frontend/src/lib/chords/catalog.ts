/**
 * The chords that get their own public page (/chord/[slug]): every root with
 * the chord types people actually search for. Slugs read like the chord
 * ("c-sharp-m7", "a-minor") and map both ways.
 */
import { parseSymbol, QUALITIES, type ChordSpec } from "./quality";

export const CATALOG_ROOTS = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"] as const;
export const CATALOG_QUALITIES = ["", "m", "7", "maj7", "m7", "sus2", "sus4", "add9", "6", "m6", "9", "dim", "aug", "m7b5", "5", "dim7", "7sus4"].filter((id) =>
  QUALITIES.some((q) => q.id === id),
);

const QUALITY_SLUG: Record<string, string> = { "": "major", m: "minor" };

function rootSlug(root: string): string {
  return root[0].toLowerCase() + (root[1] === "#" ? "-sharp" : root[1] === "b" ? "-flat" : "");
}

export function chordSlug(root: string, quality: string): string {
  return `${rootSlug(root)}-${(QUALITY_SLUG[quality] ?? quality).toLowerCase()}`;
}

export interface CatalogChord {
  slug: string;
  symbol: string;
  root: string;
  quality: string;
}

export const CATALOG: CatalogChord[] = CATALOG_ROOTS.flatMap((root) =>
  CATALOG_QUALITIES.map((quality) => ({ slug: chordSlug(root, quality), symbol: root + quality, root, quality })),
);

const BY_SLUG = new Map(CATALOG.map((c) => [c.slug, c]));
export const chordBySlug = (slug: string) => BY_SLUG.get(slug.toLowerCase());

/** The page for a chord symbol, if it has one ("Am7" -> "/chord/a-m7"). */
export function chordPageHref(symbol: string): string | null {
  const spec = parseSymbol(symbol);
  if (!spec || spec.bassName) return null;
  const root = CATALOG_ROOTS.find((r) => parseSymbol(r)?.root === spec.root);
  if (!root || !CATALOG_QUALITIES.includes(spec.quality.id)) return null;
  return `/chord/${chordSlug(root, spec.quality.id)}`;
}

const INTERVALS: Record<number, string> = { 0: "1", 1: "b9", 2: "9", 3: "b3", 4: "3", 5: "4", 6: "b5", 7: "5", 8: "#5", 9: "6", 10: "b7", 11: "7" };

/** The chord's formula, e.g. "1 b3 5 b7" for a minor 7th (6 for a 6th chord, 2 shown as 9 in 9th chords). */
export function formula(spec: ChordSpec): string {
  return spec.quality.tones
    .map((t) => {
      if (t === 2 && !spec.quality.id.includes("9") && !spec.quality.id.includes("11") && !spec.quality.id.includes("13")) return "2";
      if (t === 5 && /11/.test(spec.quality.id)) return "11";
      if (t === 9 && spec.quality.id === "dim7") return "bb7";
      if (t === 9 && /13/.test(spec.quality.id)) return "13";
      return INTERVALS[t];
    })
    .join(" ");
}
