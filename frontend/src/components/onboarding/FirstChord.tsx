"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ChordDiagram from "@/components/ChordDiagram";
import ListeningStage from "@/components/stage/ListeningStage";
import MicrophoneRecorder, { type RecorderPhase } from "@/components/MicrophoneRecorder";
import FeedbackDisplay, { type Evaluation } from "@/components/FeedbackDisplay";
import OrbitRings from "@/components/stage/OrbitRings";
import { getFingering, submitAudio, type ChordFingering } from "@/lib/api";
import { takeVerdict, type Verdict } from "@/lib/verdict";

interface Props {
  stream: MediaStream | null;
  signedIn: boolean;
  onFinished: () => void;
}

// A minor, not E minor: Em's three Es/Bs sit on each other's overtones and the
// grader currently returns "unclear" on it, which is a poor first experience.
const CHORD = "A_minor";

/** Step 4: Am, a first open chord the grader hears reliably, with the live stage and one take. */
export default function FirstChord({ stream, signedIn, onFinished }: Props) {
  const [fingering, setFingering] = useState<ChordFingering | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [phase, setPhase] = useState<RecorderPhase>("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [tries, setTries] = useState(0);
  const [result, setResult] = useState<{ verdict: Verdict; evaluation: Evaluation; feedback: string; state: string } | null>(null);

  useEffect(() => {
    getFingering(CHORD).then(setFingering).catch(() => setFingering(null));
  }, []);

  async function onTake(blob: Blob) {
    setBusy(true);
    setError("");
    try {
      const r = await submitAudio(blob, CHORD, []);
      const evaluation = r.evaluation as Evaluation;
      setResult({ verdict: takeVerdict(r as never), evaluation, feedback: String(r.feedback ?? ""), state: String(r.state ?? "") });
      setTries((n) => n + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't grade that take");
    } finally {
      setBusy(false);
    }
  }

  const next = signedIn ? "/dashboard" : `/practice?chord=${CHORD}`;
  const passed = result?.verdict === "pass";

  if (passed) {
    return (
      <div className="flex flex-col items-center text-center gap-5" data-testid="first-chord-pass">
        <OrbitRings
          center="Am"
          centerCaption="clean"
          notes={["E", "B", "E", "G", "B", "E"].map((label) => ({ label, state: "hit" as const }))}
          className="w-[220px] h-[220px]"
        />
        <p className="text-body text-gray-200">That&apos;s a clean A minor. You&apos;re set up.</p>
        <Link
          href={next}
          onClick={onFinished}
          className="rounded-xl bg-amber-400 text-[#1c1206] px-5 py-2.5 text-sm font-semibold hover:bg-amber-300"
        >
          {signedIn ? "Go to your practice hub →" : "Start practising →"}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="step-chord">
      <p className="text-body text-gray-300 text-center">Now your first chord: A minor. Finger 1 on the B string, 1st fret; fingers 2 and 3 on the D and G strings, 2nd fret. Strum from the A string down, leaving the low E silent.</p>
      <div className="grid grid-cols-1 md:grid-cols-[200px_minmax(0,1fr)_200px] gap-3 items-center">
        <ChordDiagram fingering={fingering} fluid className="mx-auto w-[46%] max-w-[180px] md:w-full" />
        {fingering && (
          <ListeningStage
            fingering={fingering}
            analyser={analyser}
            state={phase === "idle" ? "idle" : phase === "recording" ? "recording" : "armed"}
            className="h-[150px] md:h-[220px]"
          />
        )}
        <div className="flex flex-col items-center">
          <MicrophoneRecorder
            onRecordingComplete={onTake}
            disabled={busy}
            onAnalyser={setAnalyser}
            onPhase={setPhase}
            stream={stream}
            meter={!fingering}
            size={120}
          />
          {busy && (
            <p className="text-sm text-gray-400 mt-2" role="status">
              Listening back…
            </p>
          )}
          {error && (
            <p className="text-sm text-red-300 mt-2" role="alert">
              {error}
            </p>
          )}
        </div>
      </div>
      {result && (
        <FeedbackDisplay
          feedback={result.feedback}
          evaluation={result.evaluation}
          attempt={tries}
          sessionState={result.state === "COMPLETED" ? "FEEDBACK" : result.state}
          verdict={result.verdict}
          chordName={CHORD}
          fingering={fingering}
          onRetry={() => setResult(null)}
          busy={busy}
        />
      )}
      {tries >= 2 && (
        <p className="text-center">
          <Link href={next} onClick={onFinished} className="text-sm text-amber-200 underline underline-offset-4">
            Continue to practice →
          </Link>
        </p>
      )}
    </div>
  );
}
