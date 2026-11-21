/**
 * One place to get a chord's shape: the hand-checked library shape when the app
 * has a lesson for the chord, otherwise one built on the spot by the shape finder.
 * Slash chords are always built, so the right bass note is under your thumb.
 */
import { getFingering, type ChordFingering } from "../api";
import { parseChord, toAppChordKey } from "../chordpro";
import { buildFingering } from "./voicing";

export interface ChordShape {
  fingering: ChordFingering;
  /** True when built by the shape finder (no lesson video). */
  built: boolean;
  /** Library lesson key, when there is one. */
  key: string | null;
}

const cache = new Map<string, Promise<ChordShape | null>>();

export function libraryKey(symbol: string): string | null {
  const c = parseChord(symbol);
  if (!c || c.bass) return null;
  return toAppChordKey(symbol);
}

export function shapeFor(symbol: string): Promise<ChordShape | null> {
  const sym = symbol.trim();
  if (!cache.has(sym)) {
    cache.set(
      sym,
      (async () => {
        const key = libraryKey(sym);
        if (key) {
          const f = await getFingering(key).catch(() => null);
          if (f) return { fingering: f, built: false, key };
        }
        const built = buildFingering(sym);
        return built ? { fingering: built, built: true, key } : null;
      })(),
    );
  }
  return cache.get(sym)!;
}

/** Just the fingering (null if the chord can't be read or played). */
export const fingeringFor = (symbol: string) => shapeFor(symbol).then((s) => s?.fingering ?? null);
