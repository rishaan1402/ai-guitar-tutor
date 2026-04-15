"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { getFingering } from "@/lib/api";
import type { ChordFingering } from "@/lib/api";
import { detectPeaks, stabilizeNotes } from "@/lib/noteDetection";
import { useMetronome } from "@/lib/useMetronome";
import { saveTransitionResult, getTransitionStats } from "@/lib/transitionHistory";
import MetronomeWidget from "./MetronomeWidget";
import ChordDiagram from "./ChordDiagram";

type Phase = "idle" | "countdown" | "active" | "results";

interface ChordPair {
  keyA: string;
  keyB: string;
  symbolA: string;
  symbolB: string;
}

const PRESETS: ChordPair[] = [
  { keyA: "G_major", keyB: "C_major", symbolA: "G", symbolB: "C" },
  { keyA: "C_major", keyB: "A_minor", symbolA: "C", symbolB: "Am" },
  { keyA: "G_major", keyB: "D_major", symbolA: "G", symbolB: "D" },
  { keyA: "E_minor", keyB: "A_minor", symbolA: "Em", symbolB: "Am" },
  { keyA: "A_major", keyB: "D_major", symbolA: "A", symbolB: "D" },
];

const SESSION_DURATION = 60; // seconds

export default function TransitionTrainer() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [selectedPair, setSelectedPair] = useState<ChordPair>(PRESETS[0]);
  const [switchInterval, setSwitchInterval] = useState(2); // seconds
  const [countdown, setCountdown] = useState(3);
  const [timeLeft, setTimeLeft] = useState(SESSION_DURATION);
  const [currentSide, setCurrentSide] = useState<"A" | "B">("A");
  const [switchCount, setSwitchCount] = useState(0);
  const [gotCount, setGotCount] = useState(0);
  const [missCount, setMissCount] = useState(0);
  const [liveNotes, setLiveNotes] = useState<string[]>([]);
  const [fingeringA, setFingeringA] = useState<ChordFingering | null>(null);
  const [fingeringB, setFingeringB] = useState<ChordFingering | null>(null);
  const [pastStats, setPastStats] = useState<{ tpm: number; date: string }[]>([]);

  const [metState, metControls] = useMetronome(80);

  // Refs for scoring — avoids stale closure in endSession() called from setInterval
  const gotCountRef = useRef(0);
  const missCountRef = useRef(0);

  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const liveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rollingWindowRef = useRef<string[][]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const switchTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseRef = useRef<Phase>("idle");
  phaseRef.current = phase;

  // Load fingerings when pair changes
  useEffect(() => {
    setFingeringA(null);
    setFingeringB(null);
    getFingering(selectedPair.keyA).then(setFingeringA).catch(() => {});
    getFingering(selectedPair.keyB).then(setFingeringB).catch(() => {});
  }, [selectedPair]);

  const closeMic = useCallback(() => {
    if (liveIntervalRef.current) { clearInterval(liveIntervalRef.current); liveIntervalRef.current = null; }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    audioCtxRef.current?.close();
    streamRef.current = null;
    audioCtxRef.current = null;
    analyserRef.current = null;
    setLiveNotes([]);
    rollingWindowRef.current = [];
  }, []);

  const stopSession = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (switchTimerRef.current) { clearInterval(switchTimerRef.current); switchTimerRef.current = null; }
    metControls.stop();
    closeMic();
  }, [closeMic, metControls]);

  useEffect(() => {
    return () => { stopSession(); };
  }, [stopSession]);

  async function openMic() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      // Resume immediately — required on Safari after async getUserMedia
      if (ctx.state === "suspended") await ctx.resume();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.6;
      source.connect(analyser);
      streamRef.current = stream;
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;

      liveIntervalRef.current = setInterval(() => {
        if (!analyserRef.current) return;
        const buf = new Float32Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getFloatFrequencyData(buf);
        // -52 dB threshold matches PlayAlongMode — more sensitive for real guitar input
        const peaks = detectPeaks(buf, ctx.sampleRate, 2048, -52, 8);
        rollingWindowRef.current = [...rollingWindowRef.current.slice(-2), peaks.map((p) => p.noteName)];
        // minVotes=1 for snappier real-time response
        setLiveNotes(stabilizeNotes(rollingWindowRef.current, 1));
      }, 80);
    } catch {
      // mic denied — continue without live detection
    }
  }

  function startCountdown() {
    setCountdown(3);
    setPhase("countdown");
    let c = 3;
    countdownTimerRef.current = setInterval(async () => {
      c -= 1;
      if (c <= 0) {
        clearInterval(countdownTimerRef.current!);
        countdownTimerRef.current = null;
        await openMic();
        beginSession();
      } else {
        setCountdown(c);
      }
    }, 1000);
  }

  function beginSession() {
    setPhase("active");
    setTimeLeft(SESSION_DURATION);
    setCurrentSide("A");
    setSwitchCount(0);
    setGotCount(0);
    setMissCount(0);
    // Reset refs — the timer's endSession closure reads these, not state
    gotCountRef.current = 0;
    missCountRef.current = 0;
    metControls.start();

    // Main countdown timer
    let remaining = SESSION_DURATION;
    timerRef.current = setInterval(() => {
      remaining -= 1;
      setTimeLeft(remaining);
      if (remaining <= 0) {
        clearInterval(timerRef.current!);
        timerRef.current = null;
        endSession();
      }
    }, 1000);

    // Chord switch timer
    switchTimerRef.current = setInterval(() => {
      setCurrentSide((prev) => {
        setSwitchCount((c) => c + 1);
        return prev === "A" ? "B" : "A";
      });
    }, switchInterval * 1000);
  }

  function endSession() {
    if (phaseRef.current !== "active") return;
    stopSession();
    // Use refs — gotCount/missCount state is stale here when called from the timer closure
    const finalGot = gotCountRef.current;
    const finalMiss = missCountRef.current;
    const tpm = finalGot + finalMiss;
    const today = new Date().toISOString().slice(0, 10);
    saveTransitionResult({
      chordA: selectedPair.keyA,
      chordB: selectedPair.keyB,
      chordASymbol: selectedPair.symbolA,
      chordBSymbol: selectedPair.symbolB,
      date: today,
      tpm,
      gotCount: finalGot,
      missCount: finalMiss,
    });
    // Sync state from refs so results screen shows correct values
    setGotCount(finalGot);
    setMissCount(finalMiss);
    const stats = getTransitionStats(selectedPair.keyA, selectedPair.keyB)
      .slice(0, 5)
      .map((r) => ({ tpm: r.tpm, date: r.date }));
    setPastStats(stats);
    setPhase("results");
  }

  function resetToIdle() {
    stopSession();
    setPhase("idle");
    setTimeLeft(SESSION_DURATION);
  }

  const currentFingering = currentSide === "A" ? fingeringA : fingeringB;
  const currentSymbol = currentSide === "A" ? selectedPair.symbolA : selectedPair.symbolB;
  const expectedNotes = currentFingering?.notes ?? [];
  const matchCount = liveNotes.filter((n) => expectedNotes.includes(n)).length;
  const isOnChord = expectedNotes.length > 0 && matchCount >= Math.ceil(expectedNotes.length * 0.5);

  // Timer ring
  const RING_R = 50;
  const RING_CIRC = 2 * Math.PI * RING_R;
  const ringProgress = (SESSION_DURATION - timeLeft) / SESSION_DURATION;

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6 fade-in-up">
      <div className="text-center">
        <h2 className="gradient-text text-3xl font-bold mb-1">Chord Transition Trainer</h2>
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>
          Master the #1 guitar skill — fast, clean chord changes
        </p>
      </div>

      {/* ── IDLE ── */}
      {phase === "idle" && (
        <div className="space-y-5">
          {/* Preset selector */}
          <div className="glass-card p-4">
            <h3 className="text-sm font-semibold mb-3" style={{ color: "rgba(255,255,255,0.7)" }}>
              Choose a Chord Pair
            </h3>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => {
                const active = p.keyA === selectedPair.keyA && p.keyB === selectedPair.keyB;
                return (
                  <button
                    key={`${p.keyA}-${p.keyB}`}
                    onClick={() => setSelectedPair(p)}
                    className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                    style={{
                      background: active ? "rgba(124,58,237,0.25)" : "rgba(255,255,255,0.06)",
                      border: active ? "1px solid rgba(124,58,237,0.5)" : "1px solid rgba(255,255,255,0.12)",
                      color: active ? "#a78bfa" : "rgba(255,255,255,0.6)",
                    }}
                  >
                    {p.symbolA} ↔ {p.symbolB}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Switch speed */}
          <div className="glass-card p-4">
            <h3 className="text-sm font-semibold mb-3" style={{ color: "rgba(255,255,255,0.7)" }}>
              Switch Every
            </h3>
            <div className="flex gap-2">
              {[1, 2, 4].map((s) => (
                <button
                  key={s}
                  onClick={() => setSwitchInterval(s)}
                  className="flex-1 py-2 rounded-xl text-sm font-semibold transition-all"
                  style={{
                    background: switchInterval === s ? "rgba(124,58,237,0.25)" : "rgba(255,255,255,0.06)",
                    border: switchInterval === s ? "1px solid rgba(124,58,237,0.5)" : "1px solid rgba(255,255,255,0.12)",
                    color: switchInterval === s ? "#a78bfa" : "rgba(255,255,255,0.6)",
                  }}
                >
                  {s}s
                </button>
              ))}
            </div>
          </div>

          {/* Fingering previews */}
          {(fingeringA || fingeringB) && (
            <div className="flex justify-center gap-6">
              {fingeringA && <ChordDiagram fingering={fingeringA} />}
              <div className="flex items-center">
                <span className="text-3xl font-black gradient-text">↔</span>
              </div>
              {fingeringB && <ChordDiagram fingering={fingeringB} />}
            </div>
          )}

          <div className="flex justify-center">
            <button
              onClick={startCountdown}
              className="btn-gradient px-10 py-3 rounded-2xl text-base font-bold text-white"
            >
              Start 60s Session
            </button>
          </div>
        </div>
      )}

      {/* ── COUNTDOWN ── */}
      {phase === "countdown" && (
        <div className="glass-card p-12 text-center">
          <div
            className="text-9xl font-black gradient-text"
            style={{ animation: "countdown-pulse 0.8s ease-out both" }}
            key={countdown}
          >
            {countdown}
          </div>
          <p className="mt-4 text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>Get ready…</p>
        </div>
      )}

      {/* ── ACTIVE ── */}
      {phase === "active" && (
        <div className="space-y-4">
          {/* Timer ring + chord display */}
          <div className="glass-card p-6 flex flex-col items-center gap-4">
            {/* SVG ring */}
            <svg width={120} height={120}>
              <circle cx={60} cy={60} r={RING_R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={8} />
              <circle
                cx={60} cy={60} r={RING_R}
                fill="none"
                stroke="url(#timerGrad)"
                strokeWidth={8}
                strokeLinecap="round"
                strokeDasharray={RING_CIRC}
                strokeDashoffset={RING_CIRC * (1 - ringProgress)}
                transform="rotate(-90 60 60)"
                style={{ transition: "stroke-dashoffset 1s linear" }}
              />
              <defs>
                <linearGradient id="timerGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#7c3aed" />
                  <stop offset="100%" stopColor="#0891b2" />
                </linearGradient>
              </defs>
              <text x={60} y={65} textAnchor="middle" fontSize={28} fontWeight="bold" fill="white">
                {timeLeft}
              </text>
            </svg>

            {/* Current chord name */}
            <div
              key={`chord-${switchCount}`}
              className="animate-chord-swap text-7xl font-black gradient-text"
            >
              {currentSymbol}
            </div>

            {/* Live note match indicator */}
            <div
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                liveNotes.length === 0 ? "" : isOnChord ? "animate-note-match" : "animate-note-miss"
              }`}
              style={{
                background: liveNotes.length === 0
                  ? "rgba(255,255,255,0.05)"
                  : isOnChord ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
                border: liveNotes.length === 0
                  ? "1px solid rgba(255,255,255,0.1)"
                  : isOnChord ? "1px solid rgba(34,197,94,0.4)" : "1px solid rgba(239,68,68,0.3)",
                color: liveNotes.length === 0
                  ? "rgba(255,255,255,0.3)"
                  : isOnChord ? "#22c55e" : "#ef4444",
              }}
            >
              {liveNotes.length === 0 ? "🎸 Play to detect notes" : isOnChord ? "✓ On chord!" : "Keep pressing..."}
            </div>
          </div>

          {/* Self-rating buttons */}
          <div className="glass-card p-4">
            <p className="text-center text-xs mb-3" style={{ color: "rgba(255,255,255,0.5)" }}>
              Did you get that transition clean?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => { gotCountRef.current += 1; setGotCount((c) => c + 1); }}
                className="flex-1 py-3 rounded-xl text-sm font-bold transition-all"
                style={{
                  background: "rgba(34,197,94,0.15)",
                  border: "1px solid rgba(34,197,94,0.4)",
                  color: "#22c55e",
                }}
              >
                ✓ Got it! ({gotCount})
              </button>
              <button
                onClick={() => { missCountRef.current += 1; setMissCount((c) => c + 1); }}
                className="flex-1 py-3 rounded-xl text-sm font-bold transition-all"
                style={{
                  background: "rgba(239,68,68,0.1)",
                  border: "1px solid rgba(239,68,68,0.3)",
                  color: "#ef4444",
                }}
              >
                ✗ Missed ({missCount})
              </button>
            </div>
          </div>

          {/* Chord diagrams side by side with live detection on current */}
          <div className="flex justify-center gap-6">
            <div style={{ opacity: currentSide === "A" ? 1 : 0.35, transition: "opacity 0.3s" }}>
              {fingeringA && <ChordDiagram fingering={fingeringA} liveNotes={currentSide === "A" ? liveNotes : []} />}
            </div>
            <div className="flex items-center">
              <span className="text-2xl font-black" style={{ color: "rgba(255,255,255,0.3)" }}>↔</span>
            </div>
            <div style={{ opacity: currentSide === "B" ? 1 : 0.35, transition: "opacity 0.3s" }}>
              {fingeringB && <ChordDiagram fingering={fingeringB} liveNotes={currentSide === "B" ? liveNotes : []} />}
            </div>
          </div>

          <div className="flex justify-center">
            <MetronomeWidget />
          </div>

          <div className="flex justify-center">
            <button onClick={endSession} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
              End session early
            </button>
          </div>
        </div>
      )}

      {/* ── RESULTS ── */}
      {phase === "results" && (
        <div className="space-y-4">
          <div className="glass-card p-6 text-center space-y-3">
            <p className="gradient-text text-5xl font-black">{gotCount + missCount}</p>
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>transitions in 60s</p>
            <div className="flex justify-center gap-6 mt-2">
              <div>
                <p className="text-2xl font-bold" style={{ color: "#22c55e" }}>{gotCount}</p>
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>Got it</p>
              </div>
              <div>
                <p className="text-2xl font-bold" style={{ color: "#ef4444" }}>{missCount}</p>
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>Missed</p>
              </div>
            </div>
          </div>

          {/* History sparkline */}
          {pastStats.length > 1 && (
            <div className="glass-card p-4">
              <h3 className="text-xs font-semibold mb-3" style={{ color: "rgba(255,255,255,0.5)" }}>
                {selectedPair.symbolA} ↔ {selectedPair.symbolB} — Past Sessions
              </h3>
              <div className="flex items-end gap-2">
                {pastStats.map((s, i) => {
                  const maxTpm = Math.max(...pastStats.map((x) => x.tpm), 1);
                  const h = Math.max(4, (s.tpm / maxTpm) * 48);
                  return (
                    <div key={i} className="flex flex-col items-center gap-1 flex-1">
                      <div
                        className="w-full rounded-sm"
                        style={{ height: h, background: "linear-gradient(to top, #7c3aed, #0891b2)" }}
                      />
                      <span className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.6)" }}>{s.tpm}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex gap-3 justify-center">
            <button
              onClick={startCountdown}
              className="btn-gradient px-8 py-2 rounded-xl text-sm font-semibold text-white"
            >
              Practice Again
            </button>
            <button
              onClick={resetToIdle}
              className="glass px-8 py-2 rounded-xl text-sm font-medium border border-white/10 transition-all"
              style={{ color: "rgba(255,255,255,0.6)" }}
            >
              New Pair
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
