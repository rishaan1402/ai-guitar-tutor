"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import GroovePlayer from "@/components/groove/GroovePlayer";
import ChordCheck from "@/components/path/ChordCheck";
import LessonVideoPlayer from "@/components/LessonVideoPlayer";
import ChordDiagram from "@/components/ChordDiagram";
import { loadFingering } from "@/components/SongSheet/ChordPanel";
import { ALL_SESSIONS, levelOf, sessionById, type PathSession } from "@/lib/path/curriculum";
import { recordSession } from "@/lib/path/progress";
import { getAudioUrl, getVideoUrl, type ChordFingering } from "@/lib/api";
import { toAppChordKey } from "@/lib/chordpro";
import { prettySymbol } from "@/lib/chordShape";

type Step = { kind: "learn" | "check"; chord: string } | { kind: "practice" } | { kind: "gig" } | { kind: "done" };

function stepsFor(s: PathSession): Step[] {
  const steps: Step[] = [];
  for (const c of s.newChords) steps.push({ kind: "learn", chord: c }, { kind: "check", chord: c });
  if (s.practice) steps.push({ kind: "practice" });
  if (s.gig) steps.push({ kind: "gig" });
  steps.push({ kind: "done" });
  return steps;
}

export default function SessionPage() {
  return (
    <Suspense fallback={null}>
      <SessionRoute />
    </Suspense>
  );
}

function SessionRoute() {
  const session = sessionById(useSearchParams().get("id"));
  if (!session) {
    return (
      <main className="min-h-[100dvh] bg-ink-950 p-6">
        <p className="text-cream">That lesson doesn&apos;t exist.</p>
        <Link href="/path" className="mt-4 inline-block text-amber-300">← All lessons</Link>
      </main>
    );
  }
  return <Session key={session.id} session={session} />;
}

function Session({ session }: { session: PathSession }) {
  const router = useRouter();
  const steps = useMemo(() => stepsFor(session), [session]);
  const [i, setI] = useState(0);
  const [stars, setStars] = useState<{ practice?: number; gig?: number; checkSkipped?: boolean }>({});
  const step = steps[i];
  const next = () => setI((k) => Math.min(steps.length - 1, k + 1));
  const back = () => (i > 0 ? setI(i - 1) : router.push("/path"));
  const level = levelOf(session.id);
  const after = ALL_SESSIONS[ALL_SESSIONS.findIndex((s) => s.id === session.id) + 1];

  // final stars: the song if there is one, else the practice Groove, else 3 for passing the check
  const final = stars.gig ?? stars.practice ?? (stars.checkSkipped ? 1 : 3);
  useEffect(() => {
    if (step.kind === "done") void recordSession(session.id, final);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.kind]);

  if (step.kind === "practice" && session.practice) {
    return (
      <GroovePlayer
        groove={{ ...session.practice, source: "path" }}
        onFinished={(s) => {
          setStars((x) => ({ ...x, practice: s }));
          next();
        }}
        finishLabel={session.gig ? "On to the gig" : "Finish"}
        onBack={back}
      />
    );
  }
  if (step.kind === "gig" && session.gig) {
    return (
      <GroovePlayer
        groove={{ ...session.gig, source: "path" }}
        defaultMode="follow"
        onFinished={(s) => {
          setStars((x) => ({ ...x, gig: s }));
          next();
        }}
        finishLabel="Finish"
        onBack={back}
      />
    );
  }

  return (
    <main className="min-h-[100dvh] bg-ink-950 px-4 pb-10 pt-[max(1rem,env(safe-area-inset-top))]">
      <div className="flex items-center gap-3">
        <button onClick={back} aria-label="Back" className="flex h-10 w-10 items-center justify-center rounded-full border border-cream/15 text-cream/80">←</button>
        <div className="min-w-0 flex-1">
          <p className="label-mono truncate text-amber-400">{level?.title}</p>
          <h1 className="truncate font-display text-xl uppercase text-cream">{session.title}</h1>
        </div>
      </div>
      {/* progress through the session */}
      <div className="mt-4 flex gap-1.5" aria-label={`Step ${i + 1} of ${steps.length}`}>
        {steps.map((_, k) => (
          <span key={k} className={`h-1.5 flex-1 rounded-full ${k <= i ? "bg-amber-400" : "bg-cream/10"}`} />
        ))}
      </div>

      <div className="mx-auto mt-6 max-w-xl">
        {step.kind === "learn" && <Learn chord={step.chord} points={session.points} onNext={next} />}
        {step.kind === "check" && (
          <div className="space-y-4">
            <ChordCheck chord={step.chord} onPass={next} />
            <button
              onClick={() => {
                setStars((x) => ({ ...x, checkSkipped: true }));
                next();
              }}
              className="w-full text-center text-sm text-cream/45 underline-offset-4 hover:underline"
            >
              Skip for now (no mic, or a noisy room)
            </button>
          </div>
        )}
        {step.kind === "done" && (
          <div className="rounded-[26px] border border-cream/10 p-6 text-center">
            <p className="label-mono text-amber-400">Lesson complete</p>
            <div className="mt-2 text-5xl" aria-label={`${final} of 3 stars`}>
              {[0, 1, 2].map((k) => (
                <span key={k} className={k < final ? "text-amber-400" : "text-cream/15"}>★</span>
              ))}
            </div>
            <p className="mt-3 text-cream/70">
              {final === 3 ? "Clean. That one's yours." : "Good work. Come back to it later to earn every star."}
            </p>
            <div className="mt-6 flex flex-col gap-2">
              {after ? (
                <Link href={`/path/session?id=${after.id}`} className="h-12 rounded-full bg-amber-400 pt-3 font-semibold text-ink-950">Next: {after.title} →</Link>
              ) : (
                <p className="text-cream/60">You&apos;ve finished every lesson for now.</p>
              )}
              <button onClick={() => setI(0)} className="h-11 rounded-full border border-cream/15 text-cream/80">Do it again</button>
              <Link href="/path" className="h-11 rounded-full border border-cream/15 pt-2.5 text-cream/60">All lessons</Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function Learn({ chord, points, onNext }: { chord: string; points: string[]; onNext: () => void }) {
  const key = toAppChordKey(chord);
  const [shape, setShape] = useState<ChordFingering | null>(null);
  useEffect(() => {
    if (key) loadFingering(key).then(setShape).catch(() => {});
  }, [key]);
  return (
    <div className="space-y-4">
      <p className="label-mono text-amber-400">New chord · {prettySymbol(chord)}</p>
      {key && <LessonVideoPlayer videoPath={getVideoUrl(key)} audioUrl={getAudioUrl(key)} chordName={key} />}
      <div className="flex gap-4">
        {shape && <ChordDiagram fingering={shape} caption={chord} />}
        <ul className="flex-1 space-y-2 text-[15px] text-cream/80">
          {points.map((p) => (
            <li key={p} className="flex gap-2">
              <span className="text-amber-400">•</span>
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </div>
      <button onClick={onNext} className="h-12 w-full rounded-full bg-amber-400 font-semibold text-ink-950">I&apos;ve got the shape →</button>
    </div>
  );
}
