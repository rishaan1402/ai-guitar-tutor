"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import GroovePlayer from "@/components/groove/GroovePlayer";
import ChordCheck from "@/components/path/ChordCheck";
import LessonVideoPlayer from "@/components/LessonVideoPlayer";
import ChordDiagram from "@/components/ChordDiagram";
import ChordLesson from "@/components/chords/ChordLesson";
import ChordTips from "@/components/chords/ChordTips";
import Celebrate from "@/components/game/Celebrate";
import { libraryKey, shapeFor } from "@/lib/chords/shape";
import { EarStep, PlayStep, QuizStep, ReadStep, RhythmStep } from "@/components/path/steps/Steps";
import { EchoStep, FretGameStep, ImproviseStep, LadderStep } from "@/components/path/steps/MoreSteps";
import { ALL_SESSIONS, checkAdvice, isCheck, levelOf, sessionAfter, sessionById, trackOf, type PathSession } from "@/lib/path/curriculum";
import { chordsIn, SCORED, sessionStars, type Step } from "@/lib/path/steps";
import { loadPathProgress, recordSession } from "@/lib/path/progress";
import { buildSongSession, loadSongLesson } from "@/lib/path/songLesson";
import { buildReview } from "@/lib/path/review";
import { getAudioUrl, getVideoUrl, type ChordFingering } from "@/lib/api";
import { prettySymbol } from "@/lib/chordShape";

export default function SessionPage() {
  return (
    <Suspense fallback={null}>
      <SessionRoute />
    </Suspense>
  );
}

/** Chords from every session you've earned stars on. */
function knownChords(done: Record<string, number>): Set<string> {
  return new Set(ALL_SESSIONS.filter((s) => done[s.id] > 0).flatMap(chordsIn));
}

/** Today on this device, YYYY-MM-DD (the daily review changes at local midnight). */
function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function SessionRoute() {
  const params = useSearchParams();
  const songSlug = params.get("song");
  const isReviewRoute = params.get("review") === "1";
  const fixed = sessionById(params.get("id"));
  const [song, setSong] = useState<PathSession | null | undefined>(undefined);

  useEffect(() => {
    if (isReviewRoute) {
      loadPathProgress().then((done) => setSong(buildReview(done, today())));
      return;
    }
    if (!songSlug) return;
    const src = loadSongLesson(songSlug);
    if (!src) return setSong(null);
    loadPathProgress().then((done) => setSong(buildSongSession(songSlug, src, knownChords(done))));
  }, [songSlug, isReviewRoute]);

  const built = songSlug || isReviewRoute;
  const session = built ? song : fixed;
  if (built && song === undefined) return <main className="min-h-[100dvh] bg-ink-950" />;
  if (!session) {
    return (
      <main className="min-h-[100dvh] bg-ink-950 p-6">
        <p className="text-cream">
          {isReviewRoute
            ? "Finish a few lessons first: the daily review is built from what you've learned."
            : songSlug
              ? "That song lesson isn't on this device. Open the song again from Learn any song."
              : "That lesson doesn't exist."}
        </p>
        <Link href="/path" className="mt-4 inline-block text-amber-300">← All lessons</Link>
      </main>
    );
  }
  return <Session key={session.id} session={session} isSong={!!songSlug} isReview={isReviewRoute} />;
}

function Session({ session, isSong, isReview = false }: { session: PathSession; isSong: boolean; isReview?: boolean }) {
  const router = useRouter();
  const steps = session.steps;
  const total = steps.length + 1; // + the done screen
  const [i, setI] = useState(0);
  const [scores, setScores] = useState<Record<number, number>>({});
  const [skipped, setSkipped] = useState(false);
  const step: Step | undefined = steps[i];
  const finish = (k: number, stars: number | null) => {
    if (stars !== null) setScores((x) => ({ ...x, [k]: stars }));
    setI(k + 1);
  };
  const back = () => (i > 0 ? setI(i - 1) : router.push("/path"));
  const level = levelOf(session.id);
  const track = trackOf(session.id);
  const after = isSong || isReview ? undefined : sessionAfter(session.id);
  const scoredCount = steps.filter((s) => SCORED.includes(s.kind)).length;
  const final = sessionStars(Object.values(scores), skipped || Object.keys(scores).length < scoredCount);

  useEffect(() => {
    if (i === steps.length) void recordSession(session.id, final);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);

  // a Groove takes the whole screen
  if (step?.kind === "groove") {
    const nextLabel = steps[i + 1]?.kind === "groove" ? "Next" : i + 1 >= steps.length ? "Finish" : "Continue";
    return (
      <GroovePlayer
        key={`${session.id}-${i}`}
        groove={{ ...step.groove, source: isSong ? "song" : "path" }}
        defaultMode={step.mode}
        onFinished={(s) => finish(i, s)}
        finishLabel={nextLabel}
        onBack={back}
      />
    );
  }

  return (
    <main className="min-h-[100dvh] bg-ink-950 px-4 pb-10 pt-[max(1rem,env(safe-area-inset-top))] landscape:px-6">
      <div className="mx-auto flex max-w-5xl items-center gap-3">
        <button onClick={back} aria-label="Back" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-cream/15 text-cream/80">←</button>
        <div className="min-w-0 flex-1">
          <p className="label-mono truncate text-amber-400">{isSong ? "Song lesson" : isReview ? "Daily review" : `${track?.title ?? ""} · ${level?.title ?? ""}`}</p>
          <h1 className="truncate font-display text-xl uppercase text-cream">{session.title}</h1>
        </div>
        <span className="label-mono shrink-0 text-cream/45">{Math.min(i + 1, total)}/{total}</span>
      </div>
      <div className="mx-auto mt-3 flex max-w-5xl gap-1" aria-label={`Step ${i + 1} of ${total}`}>
        {Array.from({ length: total }, (_, k) => (
          <span key={k} className={`h-1.5 flex-1 rounded-full ${k <= i ? "bg-amber-400" : "bg-cream/10"}`} />
        ))}
      </div>

      <div className="mx-auto mt-5 max-w-5xl">
        {step?.kind === "read" && <ReadStep key={i} step={step} onDone={(s) => finish(i, s)} />}
        {step?.kind === "learn" && <Learn key={i} chord={step.chord} points={step.points} onNext={() => finish(i, null)} />}
        {step?.kind === "check" && (
          <div key={i} className="mx-auto max-w-xl space-y-4">
            <ChordCheck chord={step.chord} onPass={() => finish(i, null)} />
            <button
              onClick={() => {
                setSkipped(true);
                finish(i, null);
              }}
              className="w-full text-center text-sm text-cream/45 underline-offset-4 hover:underline"
            >
              Skip for now (no mic, or a noisy room)
            </button>
          </div>
        )}
        {step?.kind === "quiz" && <QuizStep key={i} step={step} onDone={(s) => finish(i, s)} />}
        {step?.kind === "play" && <PlayStep key={i} step={step} onDone={(s) => (s === null ? (setSkipped(true), finish(i, null)) : finish(i, s))} />}
        {step?.kind === "ear" && <EarStep key={i} step={step} onDone={(s) => finish(i, s)} />}
        {step?.kind === "rhythm" && <RhythmStep key={i} step={step} onDone={(s) => finish(i, s)} />}
        {step?.kind === "echo" && <EchoStep key={i} step={step} onDone={(s) => (s === null ? (setSkipped(true), finish(i, null)) : finish(i, s))} />}
        {step?.kind === "ladder" && <LadderStep key={i} step={step} onDone={(s) => finish(i, s)} />}
        {step?.kind === "improvise" && <ImproviseStep key={i} step={step} onDone={(s) => (s === null ? (setSkipped(true), finish(i, null)) : finish(i, s))} />}
        {step?.kind === "fretgame" && <FretGameStep key={i} step={step} onDone={(s) => finish(i, s)} />}
        {!step && level && isCheck(session.id) && <CheckResult levelId={level.id} stars={final} onAgain={() => { setI(0); setScores({}); setSkipped(false); }} />}
        {!step && !(level && isCheck(session.id)) && (
          <div className="mx-auto max-w-xl rounded-[26px] border border-cream/10 p-6 text-center">
            <p className="label-mono text-amber-400">{isSong ? "Song lesson complete" : isReview ? "Review done for today" : "Lesson complete"}</p>
            <div className="mt-3">
              <Celebrate stars={final} xp={final * 20} />
            </div>
            <p className="mt-3 text-cream/70">{final === 3 ? "Clean. That one's yours." : "Good work. Come back to it later to earn every star."}</p>
            <div className="mt-6 flex flex-col gap-2">
              {after ? (
                <Link href={`/path/session?id=${after.id}`} className="flex h-12 items-center justify-center rounded-full bg-amber-400 px-4 font-semibold text-ink-950">Next: {after.title} →</Link>
              ) : !isSong && !isReview ? (
                <p className="text-cream/60">You&apos;ve finished this track. Try another one on the Lessons page.</p>
              ) : null}
              <button onClick={() => { setI(0); setScores({}); setSkipped(false); }} className="h-11 rounded-full border border-cream/15 text-cream/80">Do it again</button>
              <Link href="/path" className="flex h-11 items-center justify-center rounded-full border border-cream/15 text-cream/60">All lessons</Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

/** After a level check: a recommendation, never a lock. */
function CheckResult({ levelId, stars, onAgain }: { levelId: string; stars: number; onAgain: () => void }) {
  const [done, setDone] = useState<Record<string, number> | null>(null);
  useEffect(() => {
    // give the check's own stars a moment to save, then read progress
    const t = setTimeout(() => loadPathProgress().then(setDone), 400);
    return () => clearTimeout(t);
  }, []);
  const advice = done ? checkAdvice(levelId, stars, done) : null;
  const firstNext = advice?.next?.sessions[0];
  return (
    <div className="mx-auto max-w-xl rounded-[26px] border border-cream/10 p-6 text-center">
      <p className="label-mono text-amber-400">Level check</p>
      <div className="mt-3">
        <Celebrate stars={stars} xp={stars * 20} />
      </div>
      {advice && (
        <>
          <p className="mt-3 text-cream/80">
            {advice.ready
              ? advice.next
                ? `You're ready for ${advice.next.title}.`
                : "You've finished this track. Try another track on the Lessons page."
              : "Nearly there. A little review first will make the next level feel easier."}
          </p>
          {!advice.ready && advice.review.length > 0 && (
            <div className="mt-4 text-left">
              <p className="label-mono text-[10px] text-cream/50">Worth revisiting</p>
              <ul className="mt-2 space-y-1.5">
                {advice.review.slice(0, 4).map((s) => (
                  <li key={s.id}>
                    <Link href={`/path/session?id=${s.id}`} className="flex items-center justify-between rounded-xl border border-cream/10 px-3 py-2 text-cream/85">
                      <span className="truncate">{s.title}</span>
                      <span className="text-amber-300">→</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="mt-6 flex flex-col gap-2">
            {firstNext && (
              <Link
                href={`/path/session?id=${firstNext.id}`}
                className={`flex h-12 items-center justify-center rounded-full px-4 font-semibold ${advice.ready ? "bg-amber-400 text-ink-950" : "border border-cream/15 text-cream/80"}`}
              >
                {advice.ready ? `Start ${advice.next!.title} →` : `Go on to ${advice.next!.title} anyway`}
              </Link>
            )}
            <button onClick={onAgain} className="h-11 rounded-full border border-cream/15 text-cream/80">Take the check again</button>
            <Link href="/path" className="flex h-11 items-center justify-center rounded-full border border-cream/15 text-cream/60">All lessons</Link>
          </div>
        </>
      )}
    </div>
  );
}

function Learn({ chord, points, onNext }: { chord: string; points: string[]; onNext: () => void }) {
  const key = libraryKey(chord);
  const [shape, setShape] = useState<ChordFingering | null>(null);
  const [built, setBuilt] = useState(false);
  useEffect(() => {
    shapeFor(chord).then((s) => {
      if (!s) return;
      setShape(s.fingering);
      setBuilt(s.built);
    });
  }, [chord]);
  const videoPath = useMemo(() => (key ? getVideoUrl(key) : null), [key]);
  // chords without a lesson video get the animated lesson, built for them
  if (built && shape) {
    return (
      <div className="space-y-4">
        <p className="label-mono text-amber-400">New chord · {prettySymbol(chord)}</p>
        <ChordLesson symbol={chord} fingering={shape} autoPlay />
        <PointList points={points} />
        <ChordTips symbol={chord} fingering={shape} />
        <button onClick={onNext} className="sticky bottom-3 z-10 h-12 w-full rounded-full bg-amber-400 font-semibold text-ink-950 shadow-lg shadow-black/40">I&apos;ve got the shape →</button>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <p className="label-mono text-amber-400">New chord · {prettySymbol(chord)}</p>
      <div className="grid gap-4 landscape:grid-cols-[1.3fr_1fr] landscape:items-start short:grid-cols-[1fr_1fr] short:gap-3">
        {key && videoPath && <LessonVideoPlayer videoPath={videoPath} audioUrl={getAudioUrl(key)} chordName={key} />}
        <div className="flex gap-4 short:gap-3">
          {shape && <div className="w-32 shrink-0 short:w-24"><ChordDiagram fingering={shape} caption={chord} fluid /></div>}
          <PointList points={points} />
        </div>
      </div>
      <button onClick={onNext} className="sticky bottom-3 z-10 h-12 w-full rounded-full bg-amber-400 font-semibold text-ink-950 shadow-lg shadow-black/40">I&apos;ve got the shape →</button>
    </div>
  );
}

function PointList({ points }: { points: string[] }) {
  return (
    <ul className="flex-1 space-y-2 text-[15px] text-cream/80 short:space-y-1 short:text-sm">
      {points.map((p) => (
        <li key={p} className="flex gap-2">
          <span className="text-amber-400">•</span>
          <span>{p}</span>
        </li>
      ))}
    </ul>
  );
}
