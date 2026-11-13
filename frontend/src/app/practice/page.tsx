"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import ChordSelector from "@/components/ChordSelector";
import LessonVideoPlayer from "@/components/LessonVideoPlayer";
import MicrophoneRecorder, { type RecorderPhase } from "@/components/MicrophoneRecorder";
import ListeningStage from "@/components/stage/ListeningStage";
import FeedbackDisplay from "@/components/FeedbackDisplay";
import ChordDiagram from "@/components/ChordDiagram";
import type { Evaluation } from "@/components/FeedbackDisplay";
import ProgressDashboard from "@/components/ProgressDashboard";
import StepIndicator from "@/components/StepIndicator";
import ModeToggle, { AppMode } from "@/components/ModeToggle";

function parseMode(v: string | null): AppMode {
  return v === "song" || v === "transitions" ? v : "chords";
}
import SongCouncil from "@/components/SongCouncil";
import type { SongCouncilContext } from "@/components/SongCouncil";
import MetronomeWidget from "@/components/MetronomeWidget";
import TransitionTrainer, { pairFromParams } from "@/components/TransitionTrainer";
import NavBar from "@/components/NavBar";
import {
  getLesson,
  submitAudio,
  getVideoUrl,
  getAudioUrl,
  getFingering,
  listChords,
  getPlan,
} from "@/lib/api";
import { getAccessToken } from "@/lib/auth";
import type { RecapNext } from "@/lib/recap";
import {
  appendTake,
  canFinish,
  loadLog,
  newLog,
  recapOnLeave,
  saveLog,
  type LoggedTake,
  type SessionLog,
} from "@/lib/sessionLog";
import { formatChord, nextBeginnerChord } from "@/lib/chordName";
import type { ChordFingering } from "@/lib/api";
import { loadProgress, recordAttempt } from "@/lib/progress";
import type { ProgressData } from "@/lib/progress";
import { applyTake, isGraded, nextUnclearStreak, takeVerdict, type Verdict } from "@/lib/verdict";
import { useMediaQuery } from "@/lib/usePointer";
import { COPY, UNCLEAR_STREAK_NUDGE } from "@/lib/feedbackCopy";

const SessionRecap = dynamic(() => import("./_components/SessionRecap"), {
  ssr: false,
  loading: () => <div className="min-h-[60vh]" aria-busy="true" />,
});

const SignedOutToast = dynamic(() => import("@/components/SignedOutToast"), { ssr: false });

const ONBOARDED_KEY = "agt:onboarded";
const SETUP_HINT_DISMISSED_KEY = "agt:setup-hint-dismissed";

function readFlag(key: string): boolean {
  try {
    return typeof window !== "undefined" && window.localStorage.getItem(key) === "1";
  } catch {
    return true; // storage blocked: don't nag
  }
}

function setFlag(key: string): void {
  try {
    window.localStorage.setItem(key, "1");
  } catch {
    // ignore
  }
}

const STEPS = [
  {
    label: "Watch",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    label: "Listen",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
      </svg>
    ),
  },
  {
    label: "Play",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
      </svg>
    ),
  },
  {
    label: "Review",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
      </svg>
    ),
  },
];


interface NextChord {
  key: string;
  label: string;
}

/** First chord on the user's plan that isn't the current one, else the next beginner chord. */
async function suggestNextChord(current: string): Promise<NextChord> {
  if (getAccessToken()) {
    try {
      const plan = await getPlan();
      const item = plan.items.find((i) => i.chord_key && i.chord_key !== current && i.type !== "transition");
      if (item?.chord_key) {
        return { key: item.chord_key, label: item.chord_symbol || formatChord(item.chord_key) };
      }
    } catch {
      // fall through to the beginner path
    }
  }
  const key = nextBeginnerChord(current);
  return { key, label: formatChord(key) };
}

/** Shared by the live page and its Suspense fallback so both reserve the same heights. */
function SessionHeader({ title, stepText, right, extra }: { title: string; stepText: string; right?: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <div className="flex justify-between items-start gap-3 min-h-[3.25rem] sm:min-h-[3.5rem]">
      <div className="min-w-0">
        <h1 className="font-display text-h2 gradient-text tracking-tight leading-tight" tabIndex={-1} id="practice-title">
          {title}
        </h1>
        <p className="text-xs text-gray-500 mt-0.5">{stepText}</p>
        {extra}
      </div>
      <div className="flex gap-2 shrink-0">{right}</div>
    </div>
  );
}

const HERO: Record<AppMode, { kicker: string; title: string; body: string }> = {
  chords: {
    kicker: "The amp",
    title: "Practice a chord",
    body: "Pick a chord, watch it, hear it, then play it into your mic. You'll hear back about every string.",
  },
  song: {
    kicker: "The record player",
    title: "Learn any song",
    body: "Name a song. You get its chord chart, tabs, a lesson for each section and a play-along.",
  },
  transitions: {
    kicker: "The metronome",
    title: "Chord changes",
    body: "One-minute changes: switch between two chords until it's automatic, and beat your last count.",
  },
};

function IdleHero({ mode }: { mode: AppMode }) {
  const h = HERO[mode];
  return (
    <header className="animate-enter">
      <p className="label-mono text-amber-300">{h.kicker}</p>
      <h1 className="mt-2 font-display text-h1 uppercase text-cream">{h.title}</h1>
      <p className="mt-3 max-w-xl text-cream/70">{h.body}</p>
    </header>
  );
}

/**
 * Pre-rendered stand-in while the query string is read. A tiny inline script
 * marks <html data-practice-deeplink> before first paint, so a
 * /practice?chord=… visit paints the session layout (no shift when it loads)
 * and a plain /practice visit paints the chord picker's hero.
 */
function PracticeSkeleton() {
  return (
    <main className="min-h-screen">
      <script
        dangerouslySetInnerHTML={{
          __html:
            "try{document.documentElement.dataset.practiceDeeplink=/[?&]chord=/.test(location.search)?'1':'0'}catch(e){}",
        }}
      />
      <NavBar />
      <div className="max-w-4xl mx-auto px-4 py-4 sm:py-8">
        <div className="practice-skel-deeplink space-y-4 sm:space-y-6">
          <SessionHeader title={"\u00a0"} stepText={`Step 1 of ${STEPS.length} — ${STEPS[0].label}`} />
          <StepIndicator steps={STEPS} currentStep={0} completedSteps={new Set()} />
          <LessonVideoPlayer videoPath={null} audioUrl={null} chordName="" pending />
        </div>
        <div className="practice-skel-idle">
          <IdleHero mode="chords" />
        </div>
      </div>
    </main>
  );
}

export default function PracticePage() {
  return (
    <Suspense fallback={<PracticeSkeleton />}>
      <PracticeInner />
    </Suspense>
  );
}

function PracticeInner() {
  const params = useSearchParams();
  const router = useRouter();
  const deepChord = params.get("chord");
  const modeParam = params.get("mode");
  const [mode, setMode] = useState<AppMode>(() => parseMode(modeParam));
  // Nav links change only the query (/practice -> /practice?mode=song): follow them.
  useEffect(() => {
    setMode(parseMode(modeParam));
  }, [modeParam]);
  /** A ?chord= deep link we're loading: the session layout renders right away. */
  const [pendingChord, setPendingChord] = useState<string | null>(deepChord);
  const [progress, setProgress] = useState<ProgressData>({ chords: {}, practiceStreak: 0, lastPracticeDate: null });
  const [totalChords, setTotalChords] = useState(84);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sessionState, setSessionState] = useState("IDLE");
  const [chordName, setChordName] = useState("");
  const [videoPath, setVideoPath] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [fingering, setFingering] = useState<ChordFingering | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [tuning, setTuning] = useState<{ cents: number | null; warning: boolean }>({ cents: null, warning: false });
  const [scoreHistory, setScoreHistory] = useState<{ attempt: number; score: number }[]>([]);
  const [fingeringTips, setFingeringTips] = useState<
    { note: string; string: number; fret: number; finger?: number | null; tip: string }[]
  >([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [analysis, setAnalysis] = useState<any>(null);
  const [nextChord, setNextChord] = useState<NextChord | null>(null);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  /** Takes in a row we couldn't grade (unclear / no sound / dropped silent take). */
  const [unclearStreak, setUnclearStreak] = useState(0);
  // Live listening stage: the recorder hands over its analyser and phase.
  const [stageAnalyser, setStageAnalyser] = useState<AnalyserNode | null>(null);
  const [recPhase, setRecPhase] = useState<RecorderPhase>("idle");
  const isPhone = useMediaQuery("(max-width: 767px)");

  // Stepper state
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const stepContentRef = useRef<HTMLDivElement>(null);

  // Song council context (set when user clicks "Practice" from a song lesson)
  const [songContext, setSongContext] = useState<SongCouncilContext | null>(null);
  // Whether we came from the song council (so "Back to Song" button shows)
  const [fromSong, setFromSong] = useState(false);
  // Live note detection during Step 2 recording
  const [liveNotes, setLiveNotes] = useState<string[]>([]);

  // This session's takes (recap) and the signed-out notice.
  const logRef = useRef<SessionLog>(newLog());
  const [logVersion, setLogVersion] = useState(0);
  const [showRecap, setShowRecap] = useState(false);
  /** Snapshot of the log + next suggestion when the recap opened. */
  const [recapInput, setRecapInput] = useState<{ log: SessionLog; next: RecapNext | null; signedIn: boolean } | null>(null);
  /** After the recap: where "Done" / "New Chord" was heading. */
  const afterRecapRef = useRef<(() => void) | null>(null);
  const [signedOutNonce, setSignedOutNonce] = useState(0);
  const [showSetupHint, setShowSetupHint] = useState(false);

  const logTake = useCallback((take: Omit<LoggedTake, "t">) => {
    logRef.current = appendTake(logRef.current, { ...take, t: Date.now() });
    saveLog(logRef.current);
    setLogVersion((v) => v + 1);
  }, []);

  useEffect(() => {
    setProgress(loadProgress());
    logRef.current = loadLog();
    saveLog(logRef.current);
    setShowSetupHint(!readFlag(ONBOARDED_KEY) && !readFlag(SETUP_HINT_DISMISSED_KEY));
    listChords().then((data) => setTotalChords(data.chords.length)).catch(() => {});
    // Deep link from "Assigned to you" / the recap: /practice?chord=G_major
    if (deepChord) handleChordSelect(deepChord);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Client-side navigation to another ?chord= (e.g. the recap's "Next").
  const lastDeepRef = useRef(deepChord);
  useEffect(() => {
    if (deepChord && deepChord !== lastDeepRef.current) {
      lastDeepRef.current = deepChord;
      setPendingChord(deepChord);
      setMode("chords");
      handleChordSelect(deepChord);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepChord]);

  // Work out the "next" suggestion once per chord, so Review can name it.
  useEffect(() => {
    if (!chordName) {
      setNextChord(null);
      return;
    }
    let cancelled = false;
    suggestNextChord(chordName).then((n) => {
      if (!cancelled) setNextChord(n);
    });
    return () => {
      cancelled = true;
    };
  }, [chordName]);

  function markStepDone(step: number) {
    setCompletedSteps((prev) => { const s = new Set(prev); s.add(step); return s; });
    setCurrentStep(step + 1);
  }

  function clearAttemptState() {
    setFeedback(null);
    setEvaluation(null);
    setFingeringTips([]);
    setAnalysis(null);
    setTuning({ cents: null, warning: false });
    setLiveNotes([]);
    setVerdict(null);
  }

  async function handleChordSelect(chord: string) {
    setLoading(true);
    setError("");
    setShowRecap(false);
    clearAttemptState();
    setScoreHistory([]);
    setAttempt(0);
    setUnclearStreak(0);
    setCurrentStep(0);
    setCompletedSteps(new Set());

    try {
      // Stateless: load the lesson and fingering; nothing is kept per browser on the server.
      const [, fingeringData] = await Promise.all([
        getLesson(chord),
        getFingering(chord).catch(() => null),
      ]);
      setChordName(chord);
      setSessionState("WAITING_FOR_PLAY");
      setVideoPath(getVideoUrl(chord));
      setAudioUrl(getAudioUrl(chord));
      setFingering(fingeringData);
      if (typeof window !== "undefined") window.scrollTo({ top: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start lesson");
    } finally {
      setPendingChord(null);
      setLoading(false);
    }
  }

  /** "Play it again": restart the same chord and jump straight to the Play step. */
  function handlePlayAgain() {
    if (!chordName) return;
    setError("");
    setSessionState("WAITING_FOR_PLAY");
    clearAttemptState();
    setCompletedSteps(new Set([0, 1]));
    setCurrentStep(2);
  }

  function handleRetry() {
    setError("");
    setLiveNotes([]);
    setCurrentStep(2);
  }

  function handleNextChord() {
    const key = nextChord?.key ?? nextBeginnerChord(chordName);
    handleChordSelect(key);
  }

  /** Open the recap (server data when signed in; the local log either way). */
  function openRecap(after: (() => void) | null = null) {
    afterRecapRef.current = after;
    const localNext = nextChord
      ? { label: nextChord.label, href: `/practice?chord=${encodeURIComponent(nextChord.key)}` }
      : null;
    setRecapInput({ log: logRef.current, next: localNext, signedIn: !!getAccessToken() });
    setShowRecap(true);
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  }

  function leaveRecap() {
    setShowRecap(false);
    const after = afterRecapRef.current;
    afterRecapRef.current = null;
    // a fresh session starts after a recap
    logRef.current = newLog();
    saveLog(logRef.current);
    setLogVersion((v) => v + 1);
    after?.();
  }

  // Called from SongCouncil when user clicks "Practice" on a chord card
  async function handlePracticeChordFromSong(chordKey: string, context: SongCouncilContext) {
    setSongContext(context);
    setFromSong(true);
    setMode("chords");
    await handleChordSelect(chordKey);
  }

  async function handleRecordingComplete(blob: Blob) {
    setLoading(true);
    setError("");

    try {
      // Only graded takes are sent as history (and only they enter it below).
      const result = await submitAudio(blob, chordName, scoreHistory.map((h) => h.score));
      const evalResult = result.evaluation as Evaluation;
      const attemptNum = result.attempt as number;
      const v = takeVerdict(result as { verdict?: unknown; evaluation?: Evaluation });
      const graded = isGraded(v);
      if (result.savedAnonymously) setSignedOutNonce((n) => n + 1);
      const cents =
        typeof result.tuning_cents === "number" ? result.tuning_cents : evalResult?.tuning_cents ?? null;
      logTake({
        chord: chordName,
        verdict: v,
        score: graded ? evalResult.score : null,
        issue: evalResult?.issue ?? null,
        tuning_cents: typeof cents === "number" ? cents : null,
        missing_notes: evalResult?.missing_notes ?? [],
      });
      setVerdict(v);
      setUnclearStreak((n) => nextUnclearStreak(n, v));
      setSessionState(result.state as string);
      setFeedback(result.feedback as string);
      setEvaluation(evalResult);
      setAttempt(attemptNum);
      setTuning({
        cents: typeof cents === "number" ? cents : null,
        warning: Boolean(result.tuning_warning ?? evalResult.tuning_warning) || v === "out_of_tune",
      });
      // Unclear / out-of-tune / no-sound takes don't count: no history, no local progress, no advisor tip.
      setScoreHistory((prev) => applyTake(prev, v, attemptNum, evalResult.score));
      setFingeringTips(graded ? (result.fingering_tips as typeof fingeringTips) || [] : []);
      setAnalysis(graded ? result.analysis || null : null);
      if (chordName && graded) {
        setProgress(recordAttempt(chordName, evalResult.score));
      }

      // If we're in song-practice mode, call the Lesson Advisor for a contextual tip
      if (songContext && graded) {
        try {
          const tipResp = await songContext.recordAttempt({
            score: evalResult.score,
            detected_notes: evalResult.detected_notes || [],
            missing_notes: evalResult.missing_notes || [],
            extra_notes: evalResult.extra_notes || [],
          });
          // Replace generic feedback with the advisor's song-specific tip
          setFeedback(tipResp.tip);
        } catch {
          // Keep the original feedback if advisor fails
        }
      }

      // Reset live notes and auto-advance to review step
      setLiveNotes([]);
      setCompletedSteps(new Set([0, 1, 2]));
      setCurrentStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit audio");
    } finally {
      setLoading(false);
    }
  }

  /** New Chord / Done: show the recap first when the session has enough takes. */
  function handleLeave(then: () => void) {
    if (recapOnLeave(logRef.current)) openRecap(then);
    else then();
  }

  function handleReset() {
    setShowRecap(false);
    setPendingChord(null);
    lastDeepRef.current = null;
    if (params.get("chord")) router.replace("/practice", { scroll: false });
    setSessionState("IDLE");
    setChordName("");
    setVideoPath(null);
    setAudioUrl(null);
    setFingering(null);
    clearAttemptState();
    setAttempt(0);
    setScoreHistory([]);
    setUnclearStreak(0);
    setError("");
    setCurrentStep(0);
    setCompletedSteps(new Set());
  }

  function handleBackToSong() {
    handleReset();
    setSongContext(null);
    setFromSong(false);
    setMode("song");
  }

  function handleModeChange(newMode: AppMode) {
    // When switching to chords or transitions mode, clear song context
    if (newMode === "chords" || newMode === "transitions") {
      setSongContext(null);
      setFromSong(false);
    }
    setMode(newMode);
    // keep the URL shareable / back-button friendly
    const q = new URLSearchParams(window.location.search);
    q.delete("chord");
    if (newMode === "chords") q.delete("mode");
    else q.set("mode", newMode);
    const qs = q.toString();
    window.history.replaceState(null, "", qs ? `/practice?${qs}` : "/practice");
  }

  const chordStatuses = Object.fromEntries(
    Object.entries(progress.chords).map(([k, v]) => [k, v.status])
  );

  const lessonReady = sessionState !== "IDLE" && !!chordName;
  const isSessionActive = lessonReady || !!pendingChord;
  // Grading is stateless (chord + history are sent), so any active session can record.
  const canRecord = lessonReady;
  const chordLabel = formatChord(pendingChord ?? chordName);
  void logVersion; // re-render when the session log changes
  const offerFinish = canFinish(logRef.current);

  function dismissSetupHint() {
    setFlag(SETUP_HINT_DISMISSED_KEY);
    setShowSetupHint(false);
  }

  return (
    <main className="min-h-screen">
      <NavBar />
      <div className={`max-w-4xl mx-auto px-4 space-y-8 ${isSessionActive && mode === "chords" ? "py-4 sm:py-8" : "py-8"}`}>
        {showRecap && recapInput && (
          <SessionRecap
            log={recapInput.log}
            localNext={recapInput.next}
            signedIn={recapInput.signedIn}
            onNext={(href) => {
              afterRecapRef.current = null;
              leaveRecap();
              router.push(href);
            }}
            onKeepGoing={() => {
              afterRecapRef.current = null;
              setShowRecap(false);
            }}
            onDone={leaveRecap}
          />
        )}

        {/* Brand hero + progress: hidden while a chord is active (focus mode) */}
        {!showRecap && !(isSessionActive && mode === "chords") && (
          <>
            <IdleHero mode={mode} />
          </>
        )}

        {/* Mode Toggle — only show when not actively practicing a chord */}
        {!showRecap && !isSessionActive && (
          <div className="animate-enter" style={{ "--i": 3 } as React.CSSProperties}>
            <ModeToggle mode={mode} onChange={handleModeChange} />
          </div>
        )}

        {/* ── CHORDS MODE ─────────────────────────────────────────── */}
        <div style={{ display: mode === "chords" && !showRecap ? "block" : "none" }}>
          {/* Chord Selector — shown when IDLE */}
          {!isSessionActive && (
            <section className="animate-enter space-y-8" style={{ "--i": 3 } as React.CSSProperties}>
              <ProgressDashboard progress={progress} totalChords={totalChords} />
              <h2 className="sr-only">Choose a chord</h2>
              <ChordSelector
                onSelect={handleChordSelect}
                disabled={loading}
                chordStatuses={chordStatuses}
              />
            </section>
          )}

          {/* Error (outside the Play step; there it sits next to Record) */}
          {error && !(isSessionActive && currentStep === 2) && (
            <div className="glass rounded-xl p-4 border border-red-500/30 text-red-300 mt-4" role="alert">
              {error}
            </div>
          )}

          {/* Loading skeleton */}
          {loading && !isSessionActive && (
            <div className="flex justify-center py-6 mt-4">
              <div className="flex gap-2 items-center text-gray-400 text-sm">
                <div className="w-4 h-4 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
                Processing...
              </div>
            </div>
          )}

          {/* Session: stepper + content */}
          {isSessionActive && (
            <div className="space-y-4 sm:space-y-6">
              {/* Chord title + navigation */}
              <SessionHeader
                title={chordLabel}
                stepText={`Step ${currentStep + 1} of ${STEPS.length} — ${STEPS[currentStep]?.label}`}
                extra={
                  fromSong ? (
                    <p className="text-xs mt-1" style={{ color: "#efc27a" }}>
                      Song practice mode — advisor tip after each attempt
                    </p>
                  ) : null
                }
                right={
                  <>
                    {fromSong && (
                      <button
                        onClick={() => handleLeave(handleBackToSong)}
                        className="glass text-sm px-3 py-1.5 rounded-lg border transition-colors"
                        style={{
                          color: "#efc27a",
                          borderColor: "rgba(var(--accent-rgb),0.4)",
                        }}
                      >
                        ← Song
                      </button>
                    )}
                    <button
                      onClick={() => handleLeave(handleReset)}
                      className="glass text-sm text-gray-400 hover:text-white px-3 py-1.5 rounded-lg border border-white/10 transition-colors"
                    >
                      {fromSong ? "Done" : "New Chord"}
                    </button>
                  </>
                }
              />

              {/* Step indicator */}
              <StepIndicator
                steps={STEPS}
                currentStep={currentStep}
                completedSteps={completedSteps}
              />

              {/* Metronome Widget — on Listen it sits above; on Play it moves below Record */}
              {currentStep === 1 && (
                <div className="flex justify-end">
                  <MetronomeWidget />
                </div>
              )}

              {/* Step content */}
              <div ref={stepContentRef} key={currentStep} className={lessonReady ? "animate-enter-fast" : undefined}>

                {/* Step 0: Watch */}
                {currentStep === 0 && (
                  <LessonVideoPlayer
                    pending={!lessonReady}
                    videoPath={videoPath}
                    audioUrl={null}
                    chordName={chordName}
                    onVideoEnd={() => markStepDone(0)}
                  />
                )}

                {/* Step 1: Listen */}
                {currentStep === 1 && (
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4">
                    <LessonVideoPlayer
                      videoPath={null}
                      audioUrl={audioUrl}
                      chordName={chordName}
                      onAudioEnd={() => markStepDone(1)}
                    />
                    <ChordDiagram fingering={fingering} />
                  </div>
                )}

                {/* Step 2: Play — diagram, live listening stage and Record share the viewport */}
                {currentStep === 2 && (
                  <div className="space-y-3 sm:space-y-4">
                    <div
                      className={`grid grid-cols-1 gap-3 md:gap-4 items-center ${
                        fingering ? "md:grid-cols-[200px_minmax(0,1fr)_210px] lg:grid-cols-[220px_minmax(0,1fr)_230px]" : "md:grid-cols-[minmax(0,220px)_1fr]"
                      }`}
                    >
                      <ChordDiagram
                        fingering={fingering}
                        liveNotes={liveNotes}
                        fluid
                        className="mx-auto w-[58%] max-w-[210px] md:w-full md:max-w-[220px]"
                      />
                      {fingering && (
                        <ListeningStage
                          fingering={fingering}
                          analyser={stageAnalyser}
                          state={recPhase === "idle" ? "idle" : recPhase === "recording" ? "recording" : "armed"}
                          className="h-[180px] md:h-[280px]"
                        />
                      )}
                      <section
                        className={fingering ? "flex flex-col items-center min-w-0" : "glass-card"}
                        aria-label={`Record ${chordLabel}`}
                      >
                        {canRecord ? (
                          <MicrophoneRecorder
                            onRecordingComplete={handleRecordingComplete}
                            disabled={loading}
                            onLiveNotes={setLiveNotes}
                            onAnalyser={fingering ? setStageAnalyser : undefined}
                            onPhase={setRecPhase}
                            onSilentTake={() => {
                              setUnclearStreak((n) => nextUnclearStreak(n, "silent"));
                              logTake({ chord: chordName, verdict: "silent", score: null, issue: null, tuning_cents: null });
                            }}
                            onDroppedTake={() => {
                              setUnclearStreak((n) => nextUnclearStreak(n, "dropped"));
                              logTake({ chord: chordName, verdict: "dropped", score: null, issue: null, tuning_cents: null });
                            }}
                            meter={!fingering}
                            size={fingering && isPhone ? 120 : 148}
                          />
                        ) : (
                          <div className="flex justify-center">
                            <button onClick={handlePlayAgain} className="btn-gradient px-5 py-2.5 rounded-xl text-sm font-semibold">
                              Restart lesson
                            </button>
                          </div>
                        )}
                        {loading && (
                          <div className="flex items-center justify-center gap-2 text-gray-400 text-sm mt-3" role="status">
                            <div className="w-3 h-3 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
                            {songContext ? "Getting advisor tip..." : "Analyzing your playing..."}
                          </div>
                        )}
                        {error && (
                          <p className="mt-3 text-sm text-red-300 text-center rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2" role="alert">
                            {error}
                          </p>
                        )}
                      </section>
                    </div>
                    {unclearStreak >= UNCLEAR_STREAK_NUDGE && (
                      <p className="text-sm text-amber-200 text-center rounded-xl border border-amber-300/25 bg-amber-300/[0.05] px-3 py-2" role="status" data-testid="unclear-nudge">
                        {COPY.streakNudge}
                      </p>
                    )}
                    <div className="flex justify-end">
                      <MetronomeWidget />
                    </div>
                  </div>
                )}

                {/* Step 3: Review */}
                {currentStep === 3 && !evaluation && !feedback && (
                  <div className="glass-card text-center space-y-3">
                    <p className="text-gray-300">No take yet — record one to get feedback.</p>
                    <button onClick={handleRetry} className="btn-gradient px-5 py-2.5 rounded-xl text-sm font-semibold">
                      Record a take
                    </button>
                  </div>
                )}
                {currentStep === 3 && (
                  <FeedbackDisplay
                    feedback={feedback}
                    evaluation={evaluation}
                    attempt={attempt}
                    sessionState={sessionState}
                    fingeringTips={fingeringTips}
                    scoreHistory={scoreHistory}
                    analysis={analysis}
                    fingering={fingering}
                    tuningCents={tuning.cents}
                    tuningWarning={tuning.warning}
                    verdict={verdict}
                    chordName={chordName}
                    unclearStreak={unclearStreak}
                    onRetry={handleRetry}
                    onPlayAgain={handlePlayAgain}
                    onNext={handleNextChord}
                    nextLabel={nextChord?.label ?? null}
                    busy={loading}
                  />
                )}
                {currentStep === 3 && offerFinish && (evaluation || feedback) && (
                  <div className="flex justify-center pt-4">
                    <button
                      type="button"
                      onClick={() => openRecap(null)}
                      disabled={loading}
                      className="text-sm text-gray-300 hover:text-amber-200 underline underline-offset-4 decoration-white/20 disabled:opacity-40"
                      data-testid="finish-session"
                    >
                      Finish session — see your recap
                    </button>
                  </div>
                )}
              </div>

              {/* Navigation */}
              <div className="flex justify-between items-center pt-2">
                <button
                  onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
                  disabled={currentStep === 0}
                  className="glass px-4 py-2 rounded-xl text-sm font-medium text-gray-300 border border-white/10 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  ← Back
                </button>

                {currentStep < 2 && (
                  <button
                    onClick={() => markStepDone(currentStep)}
                    disabled={loading}
                    className="btn-gradient px-5 py-2 rounded-xl text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next →
                  </button>
                )}
                {currentStep === 2 && (
                  <button
                    onClick={() => markStepDone(2)}
                    disabled={loading}
                    className="text-sm text-gray-400 hover:text-gray-200 underline-offset-4 hover:underline disabled:opacity-40 transition-colors"
                  >
                    {evaluation ? "See last result →" : "Skip →"}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── SONG MODE ───────────────────────────────────────────── */}
        <div style={{ display: mode === "song" && !showRecap ? "block" : "none" }}>
          <SongCouncil onPracticeChord={handlePracticeChordFromSong} />
        </div>

        {/* ── TRANSITIONS MODE ────────────────────────────────────── */}
        <div style={{ display: mode === "transitions" && !showRecap ? "block" : "none" }}>
          <TransitionTrainer initialPair={pairFromParams((k) => params.get(k))} />
        </div>
        {/* Below everything, so it never shifts the lesson when it appears after mount */}
        {showSetupHint && !showRecap && (!isSessionActive || currentStep === 3) && (
          <p className="text-sm text-gray-300 text-center" data-testid="setup-hint">
            New here?{" "}
            <Link href="/start" className="text-amber-200 underline underline-offset-4">
              Check my setup (30 s)
            </Link>
            <button
              type="button"
              onClick={dismissSetupHint}
              className="ml-3 text-gray-500 hover:text-gray-300 text-xs"
              aria-label="Dismiss setup check suggestion"
            >
              Not now
            </button>
          </p>
        )}

      </div>
      {signedOutNonce > 0 && (
        <SignedOutToast
          nonce={signedOutNonce}
          signInHref={`/login?next=${encodeURIComponent(`/practice?chord=${chordName}`)}`}
        />
      )}
    </main>
  );
}
