"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { LessonDocument, getFingering } from "@/lib/api";
import type { ChordFingering } from "@/lib/api";
import { detectPeaks, stabilizeNotes, bpmFromTempoFeel } from "@/lib/noteDetection";
import { useMetronome } from "@/lib/useMetronome";
import MetronomeWidget from "../MetronomeWidget";
import ChordDiagram from "../ChordDiagram";

interface Props {
  lesson: LessonDocument;
  onClose: () => void;
}

type BlockResult = "great" | "ok" | "miss" | null;
type FlashType = "GREAT!" | "OK" | "MISS" | null;

const BLOCK_WIDTH = 120;
const BLOCK_GAP = 20;
const MARKER_X = 100;
const CANVAS_HEIGHT = 140;
const LANE_Y = 20;
const LANE_H = 100;

/** Safe rounded rect — falls back to fillRect on browsers without roundRect */
function safeRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
  if (typeof (ctx as any).roundRect === "function") {
    ctx.beginPath();
    (ctx as any).roundRect(x, y, w, h, r);
  } else {
    // Manual rounded rect via arcs
    const ri = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + ri, y);
    ctx.lineTo(x + w - ri, y);
    ctx.arcTo(x + w, y, x + w, y + ri, ri);
    ctx.lineTo(x + w, y + h - ri);
    ctx.arcTo(x + w, y + h, x + w - ri, y + h, ri);
    ctx.lineTo(x + ri, y + h);
    ctx.arcTo(x, y + h, x, y + h - ri, ri);
    ctx.lineTo(x, y + ri);
    ctx.arcTo(x, y, x + ri, y, ri);
    ctx.closePath();
  }
}

function getBpm(lesson: LessonDocument): number {
  return bpmFromTempoFeel(lesson.tempo_feel || "");
}

export default function PlayAlongMode({ lesson, onClose }: Props) {
  const availableChords = lesson.practice_chords.filter((c) => c.available_in_app && c.chord_key);
  const bpm = getBpm(lesson);

  const [isRunning, setIsRunning] = useState(false);
  const [currentBlockIdx, setCurrentBlockIdx] = useState(0);
  const [blockResults, setBlockResults] = useState<BlockResult[]>(
    () => new Array(availableChords.length).fill(null)
  );
  const [flashResult, setFlashResult] = useState<FlashType>(null);
  const [liveNotes, setLiveNotes] = useState<string[]>([]);
  const [fingerings, setFingerings] = useState<Record<string, ChordFingering>>({});

  // ── CRITICAL: use refs for everything touched inside the rAF loop ──────────
  const isRunningRef = useRef(false);        // avoids stale closure on isRunning state
  const fingeringsRef = useRef<Record<string, ChordFingering>>({});  // avoids stale fingerings
  const liveNotesRef = useRef<string[]>([]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const scrollXRef = useRef(0);
  const lastTimeRef = useRef<number | null>(null);
  const currentBlockIdxRef = useRef(0);
  const matchFramesRef = useRef(0);
  const totalFramesRef = useRef(0);
  const blockResultsRef = useRef<BlockResult[]>(new Array(availableChords.length).fill(null));

  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const liveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rollingWindowRef = useRef<string[][]>([]);

  const [, metControls] = useMetronome(bpm);

  const pixelsPerSec = (bpm / 60) * (BLOCK_WIDTH + BLOCK_GAP);

  // Keep fingeringsRef in sync with state
  useEffect(() => { fingeringsRef.current = fingerings; }, [fingerings]);
  // Keep liveNotesRef in sync
  useEffect(() => { liveNotesRef.current = liveNotes; }, [liveNotes]);

  // Load fingerings on mount
  useEffect(() => {
    availableChords.forEach((c) => {
      if (!c.chord_key) return;
      getFingering(c.chord_key)
        .then((f) => setFingerings((prev) => ({ ...prev, [c.chord_key!]: f })))
        .catch(() => {});
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const closeMic = useCallback(() => {
    if (liveIntervalRef.current) { clearInterval(liveIntervalRef.current); liveIntervalRef.current = null; }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    audioCtxRef.current?.close().catch(() => {});
    streamRef.current = null;
    audioCtxRef.current = null;
    analyserRef.current = null;
    setLiveNotes([]);
    liveNotesRef.current = [];
    rollingWindowRef.current = [];
  }, []);

  useEffect(() => {
    return () => {
      isRunningRef.current = false;
      closeMic();
      metControls.stop();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        // Looser threshold (-52) for real mic input
        const peaks = detectPeaks(buf, ctx.sampleRate, 2048, -52, 8);
        rollingWindowRef.current = [
          ...rollingWindowRef.current.slice(-2),
          peaks.map((p) => p.noteName),
        ];
        // minVotes=1 for faster real-time response
        const stable = stabilizeNotes(rollingWindowRef.current, 1);
        setLiveNotes(stable);
        liveNotesRef.current = stable;
      }, 80);
    } catch {
      // mic denied — continue without detection
    }
  }

  function flashResultMsg(type: FlashType) {
    setFlashResult(type);
    setTimeout(() => setFlashResult(null), 800);
  }

  // The actual draw loop — uses ONLY refs, no React state
  function drawFrame(timestamp: number) {
    if (!isRunningRef.current) return;  // ← the critical fix

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (lastTimeRef.current !== null) {
      const delta = Math.min((timestamp - lastTimeRef.current) / 1000, 0.1); // cap at 100ms
      scrollXRef.current += pixelsPerSec * delta;
    }
    lastTimeRef.current = timestamp;

    const n = availableChords.length;
    if (n === 0) return;

    const W = canvas.width;
    ctx.clearRect(0, 0, W, CANVAS_HEIGHT);

    // Lane background
    ctx.fillStyle = "rgba(255,255,255,0.04)";
    safeRoundRect(ctx, 0, LANE_Y, W, LANE_H, 8);
    ctx.fill();

    // Marker line
    ctx.strokeStyle = "#22d3ee";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(MARKER_X, LANE_Y);
    ctx.lineTo(MARKER_X, LANE_Y + LANE_H);
    ctx.stroke();

    // Which block is at the marker
    const newBlockIdx = Math.floor(scrollXRef.current / (BLOCK_WIDTH + BLOCK_GAP));
    const clampedIdx = Math.min(Math.max(newBlockIdx, 0), n - 1);

    if (clampedIdx !== currentBlockIdxRef.current) {
      const prevIdx = currentBlockIdxRef.current;
      const matchRatio = totalFramesRef.current > 0
        ? matchFramesRef.current / totalFramesRef.current
        : 0;
      const result: BlockResult = matchRatio >= 0.65 ? "great" : matchRatio >= 0.3 ? "ok" : "miss";

      blockResultsRef.current[prevIdx] = result;
      setBlockResults([...blockResultsRef.current]);
      flashResultMsg(result === "great" ? "GREAT!" : result === "ok" ? "OK" : "MISS");

      matchFramesRef.current = 0;
      totalFramesRef.current = 0;
      currentBlockIdxRef.current = clampedIdx;
      setCurrentBlockIdx(clampedIdx);

      // Round complete — last block just got scored (newBlockIdx exceeded array bounds)
      if (newBlockIdx >= n) {
        isRunningRef.current = false;
        setIsRunning(false);
        return; // stop the loop
      }
    }

    // Also stop if we've scrolled well past the last block (safety net)
    if (newBlockIdx > n + 1) {
      isRunningRef.current = false;
      setIsRunning(false);
      return;
    }

    // Draw chord blocks
    for (let i = 0; i < n; i++) {
      // Block starts to the right of the marker, scrolls left
      const blockLeft = MARKER_X + (BLOCK_WIDTH + BLOCK_GAP) + i * (BLOCK_WIDTH + BLOCK_GAP) - scrollXRef.current;
      if (blockLeft > W + BLOCK_WIDTH) continue;
      if (blockLeft + BLOCK_WIDTH < -10) continue;

      const isCurrent = i === clampedIdx;
      const result = blockResultsRef.current[i];

      let fillColor = "rgba(124,58,237,0.22)";
      if (isCurrent) fillColor = "rgba(124,58,237,0.50)";
      if (result === "great") fillColor = "rgba(34,197,94,0.30)";
      else if (result === "ok") fillColor = "rgba(234,179,8,0.28)";
      else if (result === "miss") fillColor = "rgba(239,68,68,0.22)";

      ctx.fillStyle = fillColor;
      safeRoundRect(ctx, blockLeft, LANE_Y + 8, BLOCK_WIDTH, LANE_H - 16, 6);
      ctx.fill();

      ctx.strokeStyle = result === "great" ? "#22c55e"
        : result === "ok" ? "#eab308"
        : result === "miss" ? "#ef4444"
        : isCurrent ? "#a78bfa" : "rgba(124,58,237,0.35)";
      ctx.lineWidth = isCurrent ? 2 : 1;
      ctx.stroke();

      // Chord name text
      ctx.fillStyle = isCurrent ? "#ffffff" : "rgba(255,255,255,0.75)";
      ctx.font = `${isCurrent ? "bold " : ""}${isCurrent ? 18 : 15}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(availableChords[i].symbol, blockLeft + BLOCK_WIDTH / 2, LANE_Y + LANE_H / 2);
    }

    // Accumulate live note match frames for current block scoring
    const currentChordKey = availableChords[clampedIdx]?.chord_key ?? "";
    const expectedNotes = fingeringsRef.current[currentChordKey]?.notes ?? [];
    if (expectedNotes.length > 0) {
      const matchCount = liveNotesRef.current.filter((n) => expectedNotes.includes(n)).length;
      totalFramesRef.current += 1;
      if (matchCount >= Math.ceil(expectedNotes.length * 0.4)) {
        matchFramesRef.current += 1;
      }
    }

    // Continue loop
    rafRef.current = requestAnimationFrame(drawFrame);
  }

  async function handleStart() {
    await openMic();
    metControls.start();

    scrollXRef.current = 0;
    currentBlockIdxRef.current = 0;
    matchFramesRef.current = 0;
    totalFramesRef.current = 0;
    blockResultsRef.current = new Array(availableChords.length).fill(null);
    setBlockResults(new Array(availableChords.length).fill(null));
    setCurrentBlockIdx(0);
    lastTimeRef.current = null;

    isRunningRef.current = true;  // set ref BEFORE scheduling rAF
    setIsRunning(true);
    rafRef.current = requestAnimationFrame(drawFrame);
  }

  function handleStop() {
    isRunningRef.current = false;
    setIsRunning(false);
    cancelAnimationFrame(rafRef.current);
    metControls.stop();
    closeMic();
  }

  async function handleRepeat() {
    cancelAnimationFrame(rafRef.current);

    scrollXRef.current = 0;
    currentBlockIdxRef.current = 0;
    matchFramesRef.current = 0;
    totalFramesRef.current = 0;
    blockResultsRef.current = new Array(availableChords.length).fill(null);
    setBlockResults(new Array(availableChords.length).fill(null));
    setCurrentBlockIdx(0);
    lastTimeRef.current = null;

    // Re-open mic if it was closed (e.g. after Stop or auto round-complete)
    if (!analyserRef.current) {
      await openMic();
    }

    isRunningRef.current = true;
    setIsRunning(true);
    rafRef.current = requestAnimationFrame(drawFrame);
  }

  const currentChord = availableChords[currentBlockIdx];
  const currentFingering = currentChord?.chord_key ? fingerings[currentChord.chord_key] : null;
  const expectedNotes = currentFingering?.notes ?? [];
  const matchCount = liveNotes.filter((n) => expectedNotes.includes(n)).length;
  const isOnChord = expectedNotes.length > 0 && matchCount >= Math.ceil(expectedNotes.length * 0.4);

  const flashColor = flashResult === "GREAT!" ? "#22c55e" : flashResult === "OK" ? "#eab308" : "#ef4444";

  if (availableChords.length === 0) {
    return (
      <div className="glass-card p-8 text-center space-y-4 max-w-xl mx-auto">
        <p className="gradient-text text-xl font-bold">Play Along</p>
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
          No app-supported chords found in this lesson. Practice individual chords first.
        </p>
        <button onClick={onClose} className="btn-gradient px-6 py-2 rounded-xl text-sm font-semibold text-white">
          ← Back to Lesson
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto space-y-4 fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="gradient-text text-2xl font-bold">🎮 Play Along</h2>
          <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
            {lesson.song_title} — {lesson.artist}
            {lesson.tempo_feel ? ` · ${lesson.tempo_feel}` : ""}
          </p>
        </div>
        <button
          onClick={() => { handleStop(); onClose(); }}
          className="glass text-sm px-3 py-1.5 rounded-lg border border-white/10 transition-colors"
          style={{ color: "rgba(255,255,255,0.5)" }}
        >
          ← Back
        </button>
      </div>

      {/* Highway canvas */}
      <div className="glass-card p-3 overflow-hidden">
        <canvas
          ref={canvasRef}
          width={760}
          height={CANVAS_HEIGHT}
          className="w-full rounded-lg"
          style={{ background: "rgba(0,0,0,0.2)" }}
        />
        {!isRunning && (
          <p className="text-center text-xs mt-2" style={{ color: "rgba(255,255,255,0.3)" }}>
            Press Start — chord blocks will scroll from right to left
          </p>
        )}
      </div>

      {/* Current chord + live detection */}
      <div className="flex justify-between items-start gap-4">
        <div className="glass-card p-4 flex-1 text-center">
          <p className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.4)" }}>Now Playing</p>
          <p className="gradient-text text-4xl font-black">{currentChord?.symbol ?? "—"}</p>
          {isRunning && (
            <div
              className={`mt-2 px-3 py-1 rounded-full text-xs font-semibold transition-all duration-200 inline-block ${
                liveNotes.length === 0 ? "" : isOnChord ? "animate-note-match" : "animate-note-miss"
              }`}
              style={{
                background: liveNotes.length === 0
                  ? "rgba(255,255,255,0.05)"
                  : isOnChord ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.12)",
                border: liveNotes.length === 0
                  ? "1px solid rgba(255,255,255,0.1)"
                  : isOnChord ? "1px solid rgba(34,197,94,0.4)" : "1px solid rgba(239,68,68,0.3)",
                color: liveNotes.length === 0
                  ? "rgba(255,255,255,0.3)"
                  : isOnChord ? "#22c55e" : "#ef4444",
              }}
            >
              {liveNotes.length === 0 ? "🎸 Play to detect" : isOnChord ? `✓ ${liveNotes.join(", ")}` : `Hearing: ${liveNotes.join(", ")}`}
            </div>
          )}
        </div>

        {currentFingering && (
          <ChordDiagram fingering={currentFingering} liveNotes={isRunning ? liveNotes : undefined} />
        )}
      </div>

      {/* Flash result overlay */}
      {flashResult && (
        <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-50">
          <div
            key={flashResult + Date.now()}
            className="animate-flash-result text-7xl font-black"
            style={{ color: flashColor, textShadow: `0 0 60px ${flashColor}88` }}
          >
            {flashResult}
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        {!isRunning ? (
          <button
            onClick={handleStart}
            className="btn-gradient px-8 py-2.5 rounded-xl text-sm font-bold text-white"
          >
            ▶ Start
          </button>
        ) : (
          <button
            onClick={handleStop}
            className="glass px-6 py-2.5 rounded-xl text-sm font-semibold border border-white/15 transition-all"
            style={{ color: "rgba(255,255,255,0.7)" }}
          >
            ⏹ Stop
          </button>
        )}
        <button
          onClick={handleRepeat}
          className="glass px-5 py-2.5 rounded-xl text-sm font-semibold border border-white/10 transition-all"
          style={{ color: "rgba(255,255,255,0.6)" }}
        >
          🔁 Repeat
        </button>
        <div className="ml-auto">
          <MetronomeWidget tempoFeel={lesson.tempo_feel} timeSignature={lesson.time_signature} />
        </div>
      </div>

      {/* Song sections */}
      {lesson.song_sections && lesson.song_sections.length > 0 && (
        <div className="glass-card p-3">
          <p className="text-xs font-semibold mb-2" style={{ color: "rgba(255,255,255,0.5)" }}>Song Structure</p>
          <div className="flex flex-wrap gap-2">
            {lesson.song_sections.map((section, i) => (
              <span key={i} className="text-xs px-2 py-1 rounded-lg" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)" }}>
                {section.name}: {section.chords.join(", ")}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
