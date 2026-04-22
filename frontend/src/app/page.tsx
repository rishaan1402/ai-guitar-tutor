"use client";

import { useEffect, useRef, useState } from "react";
import ChordSelector from "@/components/ChordSelector";
import LessonVideoPlayer from "@/components/LessonVideoPlayer";
import MicrophoneRecorder from "@/components/MicrophoneRecorder";
import FeedbackDisplay from "@/components/FeedbackDisplay";
import ChordDiagram from "@/components/ChordDiagram";
import ProgressDashboard from "@/components/ProgressDashboard";
import StepIndicator from "@/components/StepIndicator";
import ModeToggle, { AppMode } from "@/components/ModeToggle";
import SongCouncil from "@/components/SongCouncil";
import type { SongCouncilContext } from "@/components/SongCouncil";
import MetronomeWidget from "@/components/MetronomeWidget";
import TransitionTrainer from "@/components/TransitionTrainer";
import NavBar from "@/components/NavBar";
import {
  learnChord,
  submitAudio,
  resetSession,
  getVideoUrl,
  getAudioUrl,
  getFingering,
  listChords,
} from "@/lib/api";
import type { ChordFingering } from "@/lib/api";
import { loadProgress, recordAttempt } from "@/lib/progress";
import type { ProgressData } from "@/lib/progress";

interface Evaluation {
  score: number;
  detected_notes: string[];
  expected_notes: string[];
  missing_notes: string[];
  extra_notes?: string[];
  issue: string | null;
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
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
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

export default function Home() {
  const [mode, setMode] = useState<AppMode>("chords");
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
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | undefined>();
  const [scoreHistory, setScoreHistory] = useState<{ attempt: number; score: number }[]>([]);
  const [fingeringTips, setFingeringTips] = useState<
    { note: string; string: number; fret: number; finger?: number | null; tip: string }[]
  >([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [analysis, setAnalysis] = useState<any>(null);

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

  useEffect(() => {
    setProgress(loadProgress());
    listChords().then((data) => setTotalChords(data.chords.length)).catch(() => {});
  }, []);

  function markStepDone(step: number) {
    setCompletedSteps((prev) => { const s = new Set(prev); s.add(step); return s; });
    setCurrentStep(step + 1);
  }

  async function handleChordSelect(chord: string) {
    setLoading(true);
    setError("");
    setFeedback(null);
    setEvaluation(null);
    setScoreHistory([]);
    setFingeringTips([]);
    setAnalysis(null);
    setCurrentStep(0);
    setCompletedSteps(new Set());

    try {
      const [result, fingeringData] = await Promise.all([
        learnChord(chord),
        getFingering(chord).catch(() => null),
      ]);
      setChordName(chord);
      setSessionState(result.state as string);
      setVideoPath(getVideoUrl(chord));
      setAudioUrl(getAudioUrl(chord));
      setFingering(fingeringData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start lesson");
    } finally {
      setLoading(false);
    }
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
      const result = await submitAudio(blob);
      const evalResult = result.evaluation as Evaluation;
      const attemptNum = result.attempt as number;
      setSessionState(result.state as string);
      setFeedback(result.feedback as string);
      setEvaluation(evalResult);
      setAttempt(attemptNum);
      setAttemptsRemaining(result.attempts_remaining as number | undefined);
      setScoreHistory((prev) => [...prev, { attempt: attemptNum, score: evalResult.score }]);
      setFingeringTips((result.fingering_tips as typeof fingeringTips) || []);
      setAnalysis(result.analysis || null);
      if (chordName) {
        setProgress(recordAttempt(chordName, evalResult.score));
      }

      // If we're in song-practice mode, call the Lesson Advisor for a contextual tip
      if (songContext) {
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

  async function handleReset() {
    await resetSession();
    setSessionState("IDLE");
    setChordName("");
    setVideoPath(null);
    setAudioUrl(null);
    setFingering(null);
    setFeedback(null);
    setEvaluation(null);
    setAttempt(0);
    setScoreHistory([]);
    setFingeringTips([]);
    setAnalysis(null);
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
  }

  const canRecord =
    sessionState === "WAITING_FOR_PLAY" || sessionState === "FEEDBACK";

  const chordStatuses = Object.fromEntries(
    Object.entries(progress.chords).map(([k, v]) => [k, v.status])
  );

  const isSessionActive = sessionState !== "IDLE" && chordName;

  return (
    <main className="min-h-screen">
      <NavBar />
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <header className="text-center space-y-2" style={{ animation: "fade-in-up 0.4s ease-out both" }}>
          <h1 className="text-4xl sm:text-5xl font-black gradient-text tracking-tight">
            AI Guitar Tutor
          </h1>
          <p className="text-gray-400 max-w-md mx-auto">
            Select a chord, follow the guided steps, and get AI-powered feedback on your playing.
          </p>
        </header>

        {/* Progress Dashboard */}
        <div style={{ animation: "fade-in-up 0.4s ease-out 0.1s both" }}>
          <ProgressDashboard progress={progress} totalChords={totalChords} />
        </div>

        {/* Mode Toggle — only show when not actively practicing a chord */}
        {!isSessionActive && (
          <div style={{ animation: "fade-in-up 0.4s ease-out 0.15s both" }}>
            <ModeToggle mode={mode} onChange={handleModeChange} />
          </div>
        )}

        {/* ── CHORDS MODE ─────────────────────────────────────────── */}
        <div style={{ display: mode === "chords" ? "block" : "none" }}>
          {/* Chord Selector — shown when IDLE */}
          {!isSessionActive && (
            <section
              className="glass-card"
              style={{ animation: "fade-in-up 0.4s ease-out 0.2s both" }}
            >
              <h2 className="text-lg font-semibold gradient-text mb-4">Choose a Chord</h2>
              <ChordSelector
                onSelect={handleChordSelect}
                disabled={loading}
                chordStatuses={chordStatuses}
              />
            </section>
          )}

          {/* Error */}
          {error && (
            <div className="glass rounded-xl p-4 border border-red-500/30 text-red-300 mt-4">
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
            <div className="space-y-6" style={{ animation: "fade-in-up 0.4s ease-out both" }}>
              {/* Chord title + navigation */}
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold gradient-text">
                    {chordName.replace(/_/g, " ")}
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Step {currentStep + 1} of {STEPS.length} — {STEPS[currentStep]?.label}
                  </p>
                  {fromSong && (
                    <p className="text-xs mt-1" style={{ color: "#a78bfa" }}>
                      📖 Song practice mode — advisor tip after each attempt
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  {fromSong && (
                    <button
                      onClick={handleBackToSong}
                      className="glass text-sm px-3 py-1.5 rounded-lg border transition-colors"
                      style={{
                        color: "#a78bfa",
                        borderColor: "rgba(124,58,237,0.4)",
                      }}
                    >
                      ← Song
                    </button>
                  )}
                  <button
                    onClick={handleReset}
                    className="glass text-sm text-gray-400 hover:text-white px-3 py-1.5 rounded-lg border border-white/10 transition-colors"
                  >
                    {fromSong ? "Done" : "New Chord"}
                  </button>
                </div>
              </div>

              {/* Step indicator */}
              <StepIndicator
                steps={STEPS}
                currentStep={currentStep}
                completedSteps={completedSteps}
              />

              {/* Metronome Widget — outside key= div so it persists across steps */}
              {(currentStep === 1 || currentStep === 2) && (
                <div className="flex justify-end">
                  <MetronomeWidget />
                </div>
              )}

              {/* Step content */}
              <div ref={stepContentRef} key={currentStep} style={{ animation: "fade-in-up 0.3s ease-out both" }}>

                {/* Step 0: Watch */}
                {currentStep === 0 && (
                  <LessonVideoPlayer
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

                {/* Step 2: Play */}
                {currentStep === 2 && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 items-start">
                      <div className="glass-card">
                        <h3 className="text-base font-semibold gradient-text mb-3">
                          Your Turn — Play the {chordName.replace(/_/g, " ")} chord
                        </h3>
                        {canRecord ? (
                          <MicrophoneRecorder
                            onRecordingComplete={handleRecordingComplete}
                            disabled={loading}
                            onLiveNotes={setLiveNotes}
                          />
                        ) : (
                          <p className="text-gray-400 text-sm">Session not ready for recording.</p>
                        )}
                        {loading && (
                          <div className="flex items-center gap-2 text-gray-400 text-sm mt-3">
                            <div className="w-3 h-3 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
                            {songContext ? "Getting advisor tip..." : "Analyzing your playing..."}
                          </div>
                        )}
                      </div>
                      <ChordDiagram fingering={fingering} liveNotes={liveNotes} />
                    </div>
                  </div>
                )}

                {/* Step 3: Review */}
                {currentStep === 3 && (
                  <FeedbackDisplay
                    feedback={feedback}
                    evaluation={evaluation}
                    attempt={attempt}
                    attemptsRemaining={attemptsRemaining}
                    sessionState={sessionState}
                    fingeringTips={fingeringTips}
                    scoreHistory={scoreHistory}
                    analysis={analysis}
                  />
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

                <div className="flex gap-2">
                  {currentStep === 3 && canRecord && (
                    <button
                      onClick={() => setCurrentStep(2)}
                      className="glass px-4 py-2 rounded-xl text-sm font-medium text-yellow-300 border border-yellow-500/30 hover:bg-yellow-500/10 transition-all"
                    >
                      Try Again
                    </button>
                  )}
                  {currentStep < 3 && (
                    <button
                      onClick={() => {
                        setCompletedSteps((prev) => { const s = new Set(prev); s.add(currentStep); return s; });
                        setCurrentStep((s) => s + 1);
                      }}
                      disabled={loading}
                      className="btn-gradient px-5 py-2 rounded-xl text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {currentStep === 2 ? "Skip →" : "Next →"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── SONG MODE ───────────────────────────────────────────── */}
        <div style={{ display: mode === "song" ? "block" : "none" }}>
          <SongCouncil onPracticeChord={handlePracticeChordFromSong} />
        </div>

        {/* ── TRANSITIONS MODE ────────────────────────────────────── */}
        <div style={{ display: mode === "transitions" ? "block" : "none" }}>
          <TransitionTrainer />
        </div>
      </div>
    </main>
  );
}
