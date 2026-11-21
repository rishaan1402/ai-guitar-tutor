/**
 * The daily review: a short session built from your weak spots and from
 * what you've already learned (recall beats rereading):
 *   your weakest Groove again -> the drill of a lesson you scored low ->
 *   a handful of questions from lessons you've finished -> the fretboard game.
 * The same review all day (seeded by the date), a new one tomorrow.
 */
import { ALL_SESSIONS, isCheck } from "./curriculum";
import { read, S, type PathSession, type Question, type Step } from "./steps";

export const reviewId = (day: string) => `review-${day.replace(/-/g, "")}`;
export const isReview = (id: string) => id.startsWith("review-");

/** Small deterministic random from a string seed. */
function seeded(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

function shuffle<T>(xs: T[], rnd: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Enough to review once a few lessons are done. */
export const canReview = (done: Record<string, number>) =>
  ALL_SESSIONS.filter((s) => !isCheck(s.id) && (done[s.id] ?? 0) > 0).length >= 3;

export function buildReview(done: Record<string, number>, day: string): PathSession | null {
  if (!canReview(done)) return null;
  const rnd = seeded(day);
  const finished = ALL_SESSIONS.filter((s) => !isCheck(s.id) && (done[s.id] ?? 0) > 0);
  const weak = finished.filter((s) => (done[s.id] ?? 0) <= 1);
  const steps: Step[] = [];
  const why: string[] = [];

  // 1. the weakest Groove (lowest stars, then a random one of those)
  const withGroove = shuffle(finished.filter((s) => s.steps.some((st) => st.kind === "groove")), rnd).sort((a, b) => (done[a.id] ?? 0) - (done[b.id] ?? 0));
  const g = withGroove[0]?.steps.filter((st) => st.kind === "groove").pop();
  if (g && g.kind === "groove") {
    steps.push({ ...g, label: "Replay" });
    why.push(`**${withGroove[0].title}** again (${done[withGroove[0].id]}★ so far)`);
  }

  // 2. a drill from a lesson you scored low
  const drillKinds = ["play", "echo", "rhythm", "ear", "fretgame"];
  const weakDrill = shuffle(weak, rnd).flatMap((s) => s.steps.filter((st) => drillKinds.includes(st.kind)).map((st) => ({ s, st })))[0];
  if (weakDrill) {
    steps.push(weakDrill.st);
    why.push(`a drill from **${weakDrill.s.title}**`);
  }

  // 3. recall: up to five questions from finished lessons
  const qs: Question[] = shuffle(finished.flatMap((s) => s.steps.flatMap((st) => (st.kind === "quiz" ? st.questions : []))), rnd).slice(0, 5);
  if (qs.length >= 2) {
    steps.push({ kind: "quiz", title: "Remember these?", questions: qs });
    why.push("a few questions from lessons you've done");
  }

  // 4. the fretboard game, once notes on the neck are learned
  const fg = finished.flatMap((s) => s.steps.filter((st) => st.kind === "fretgame"))[0];
  if (fg && fg.kind === "fretgame") {
    steps.push({ ...fg, rounds: 8 });
    why.push("a quick fretboard game");
  }

  if (steps.length < 2) return null;
  return S(
    reviewId(day),
    "Daily review",
    "Ten minutes on your weak spots.",
    read("Today's review", `Short and mixed on purpose: going back to things a little later is how they stick.

Today: ${why.join(", ")}.`),
    ...steps,
  );
}
