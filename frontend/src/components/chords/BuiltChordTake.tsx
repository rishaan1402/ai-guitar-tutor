"use client";

/**
 * Record a take of any chord (built or from the library) and get the same
 * detailed feedback as the practice page: score, which notes rang, which
 * didn't, and per-string tips.
 */
import { useState } from "react";
import MicrophoneRecorder from "@/components/MicrophoneRecorder";
import FeedbackDisplay, { type Evaluation } from "@/components/FeedbackDisplay";
import { submitAudio, type ChordFingering } from "@/lib/api";

interface Result {
  feedback: string | null;
  evaluation: Evaluation | null;
  attempt: number;
  state: string;
  analysis: unknown;
  tips: unknown[];
  tuningCents: number | null;
  tuningWarning: boolean;
}

export default function BuiltChordTake({ symbol, fingering, libraryKey }: { symbol: string; fingering: ChordFingering; libraryKey: string | null }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scores, setScores] = useState<number[]>([]);
  const [result, setResult] = useState<Result | null>(null);

  async function grade(blob: Blob) {
    setBusy(true);
    setError(null);
    try {
      const r = libraryKey
        ? await submitAudio(blob, libraryKey, scores)
        : await submitAudio(blob, symbol, scores, { notes: fingering.notes, positions: fingering.positions });
      const ev = (r.evaluation ?? null) as Evaluation | null;
      if (ev && typeof ev.score === "number" && !ev.issue) setScores((s) => [...s, ev.score as number]);
      setResult({
        feedback: (r.feedback as string) ?? null,
        evaluation: ev,
        attempt: (r.attempt as number) ?? 1,
        state: (r.state as string) ?? "FEEDBACK",
        analysis: r.analysis ?? null,
        tips: (r.fingering_tips as unknown[]) ?? [],
        tuningCents: typeof r.tuning_cents === "number" ? (r.tuning_cents as number) : null,
        tuningWarning: Boolean(r.tuning_warning),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't grade that take.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="take-h" className="space-y-3 rounded-[22px] border border-cream/10 p-4">
      <div>
        <p id="take-h" className="label-mono text-amber-400">Detailed feedback</p>
        <p className="mt-1 text-sm text-cream/65">Record a strum of {symbol}: you&apos;ll hear back which notes rang and which strings to fix.</p>
      </div>
      {result ? (
        <FeedbackDisplay
          feedback={result.feedback}
          evaluation={result.evaluation}
          attempt={result.attempt}
          sessionState={result.state}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          fingeringTips={result.tips as any}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          analysis={result.analysis as any}
          fingering={fingering}
          tuningCents={result.tuningCents}
          tuningWarning={result.tuningWarning}
          onRetry={() => setResult(null)}
        />
      ) : (
        <div className="flex justify-center">
          <MicrophoneRecorder onRecordingComplete={grade} disabled={busy} size={120} />
        </div>
      )}
      {busy && <p className="text-center text-sm text-cream/60">Listening to your take…</p>}
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
    </section>
  );
}
