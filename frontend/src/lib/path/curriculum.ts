/**
 * The learning path: four tracks (chords & rhythm, lead & technique, theory &
 * fretboard, fingerstyle & genres), each a ladder of levels from first day to
 * professional. Every session is a short list of steps (see steps.ts).
 * Songs are traditional / public domain or original.
 */
import { CHORDS_TRACK } from "./tracks/chords";
import { LEAD_TRACK } from "./tracks/lead";
import { THEORY_TRACK } from "./tracks/theory";
import { STYLES_TRACK } from "./tracks/styles";
import { chordsIn, type PathLevel, type PathSession, type PathTrack } from "./steps";

export type { PathLevel, PathSession, PathTrack, Step } from "./steps";

export const TRACKS: PathTrack[] = [CHORDS_TRACK, LEAD_TRACK, THEORY_TRACK, STYLES_TRACK];

export const LEVELS: PathLevel[] = TRACKS.flatMap((t) => t.levels);

export const ALL_SESSIONS: PathSession[] = LEVELS.flatMap((l) => l.sessions);

export function sessionById(id: string | null | undefined): PathSession | undefined {
  return ALL_SESSIONS.find((s) => s.id === id);
}

export function levelOf(id: string): PathLevel | undefined {
  return LEVELS.find((l) => l.sessions.some((s) => s.id === id));
}

export function trackOf(id: string): PathTrack | undefined {
  return TRACKS.find((t) => t.levels.some((l) => l.sessions.some((s) => s.id === id)));
}

function sessionsOf(trackId?: string): PathSession[] {
  const t = TRACKS.find((x) => x.id === trackId);
  return t ? t.levels.flatMap((l) => l.sessions) : ALL_SESSIONS;
}

/** The first session without stars, in one track or the whole path. */
export function nextSession(done: Record<string, number>, trackId?: string): PathSession {
  const list = sessionsOf(trackId);
  return list.find((s) => !(done[s.id] > 0)) ?? list[list.length - 1];
}

/** The session after this one in its own track. */
export function sessionAfter(id: string): PathSession | undefined {
  const list = sessionsOf(trackOf(id)?.id);
  return list[list.findIndex((s) => s.id === id) + 1];
}

/** Chords taught up to and including this session, in its track (what its songs may use). */
export function chordsUpTo(id: string): string[] {
  const out: string[] = [];
  for (const s of sessionsOf(trackOf(id)?.id)) {
    out.push(...chordsIn(s));
    if (s.id === id) break;
  }
  return Array.from(new Set(out));
}
