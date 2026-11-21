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
import { chordsIn, read, S, type PathLevel, type PathSession, type PathTrack, type Question, type Step } from "./steps";

export type { PathLevel, PathSession, PathTrack, Step } from "./steps";

/** Id of a level's check session. */
export const checkId = (levelId: string) => `${levelId}-check`;
export const isCheck = (sessionId: string) => sessionId.endsWith("-check");

/**
 * A level check, built from what the level taught: up to six of its quiz
 * questions, its last Groove (usually the gig) in keep-time mode, and one
 * hands-on drill. It recommends what to do next; it never locks anything.
 */
export function levelCheck(level: PathLevel): PathSession | null {
  const steps = level.sessions.flatMap((s) => s.steps);
  const questions: Question[] = steps.flatMap((st) => (st.kind === "quiz" ? st.questions : []));
  const pick = questions.filter((_, i) => i % Math.max(1, Math.ceil(questions.length / 6)) === 0).slice(0, 6);
  const grooves = steps.filter((st) => st.kind === "groove");
  const drills = steps.filter((st) => ["play", "echo", "fretgame", "ear", "rhythm"].includes(st.kind));
  const chords = steps.flatMap((st) => (st.kind === "learn" ? [st.chord] : []));
  const out: Step[] = [];
  if (pick.length >= 2) out.push({ kind: "quiz", title: "What you know", questions: pick });
  // the level's newest chord, played for the app again
  if (chords.length) out.push({ kind: "check", chord: chords[chords.length - 1] });
  // the last one or two hands-on drills (two when there's no quiz)
  out.push(...drills.slice(pick.length >= 2 ? -1 : -2));
  const gig = grooves[grooves.length - 1];
  if (gig && gig.kind === "groove") out.push({ ...gig, mode: "play", label: "Keep time" });
  if (out.length < 2) return null;
  return S(
    checkId(level.id),
    "Level check",
    "A short check of this level. It recommends what's next; nothing is locked.",
    read("Level check", `A quick check of **${level.title}**: ${out.map((st) => (st.kind === "quiz" ? "a few questions" : st.kind === "groove" ? "the level's song, keeping time with the band" : st.kind === "check" ? `playing ${st.chord} for the app` : "a hands-on drill")).join(", ")}.

It isn't a gate: whatever you score, every lesson stays open. It tells you whether you're ready for the next level, or which lessons to revisit first.`),
    ...out,
  );
}

const withChecks = (t: PathTrack): PathTrack => ({
  ...t,
  levels: t.levels.map((l) => {
    const c = levelCheck(l);
    return c ? { ...l, sessions: [...l.sessions, c] } : l;
  }),
});

export const TRACKS: PathTrack[] = [CHORDS_TRACK, LEAD_TRACK, THEORY_TRACK, STYLES_TRACK].map(withChecks);

/** After a level check: ready for the next level, or the lessons worth revisiting first. */
export function checkAdvice(levelId: string, stars: number, done: Record<string, number>): { ready: boolean; next: PathLevel | null; review: PathSession[] } {
  const track = TRACKS.find((t) => t.levels.some((l) => l.id === levelId));
  const idx = track ? track.levels.findIndex((l) => l.id === levelId) : -1;
  const level = track?.levels[idx];
  const next = track && idx >= 0 ? track.levels[idx + 1] ?? null : null;
  const review = (level?.sessions ?? []).filter((s) => !isCheck(s.id) && (done[s.id] ?? 0) < 2);
  return { ready: stars >= 2, next, review };
}

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

/** The first session without stars, in one track or the whole path (from your placement level, if you took the test). */
export function nextSession(done: Record<string, number>, trackId?: string, fromLevel?: string): PathSession {
  let list = sessionsOf(trackId);
  const track = TRACKS.find((t) => t.id === trackId);
  const start = fromLevel && track ? track.levels.findIndex((l) => l.id === fromLevel) : -1;
  if (track && start > 0) list = track.levels.slice(start).flatMap((l) => l.sessions);
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
