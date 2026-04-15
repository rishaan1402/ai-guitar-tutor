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
const BLOCK_GAP = 16;
const MARKER_X = 90;
const CANVAS_HEIGHT = 140;
const LANE_Y = 20;
const LANE_H = 100;

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

  const [metState, metControls] = useMetronome(bpm);

  const pixelsPerSec = (bpm / 60) * (BLOCK_WIDTH + BLOCK_GAP);
  const blockDurationSec = (60 / bpm) * 2; // 2 beats per block

  // Load fingerings
  useEffect(() => {
    availableChords.forEach((c) => {
      if (!c.chord_key) return;
      getFingering(c.chord_key)
        .then((f) => setFingerings((prev) => ({ ...prev, [c.chord_key!]: f })))
        .catch(() => {});
    });
  }, []);

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

  useEffect(() => {
    return () => {
      closeMic();
      metControls.stop();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [closeMic, metControls]);

  async function openMic() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
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
        const peaks = detectPeaks(buf, ctx.sampleRate, 2048);
        rollingWindowRef.current = [...rollingWindowRef.current.slice(-2), peaks.map((p) => p.noteName)];
        const stable = stabilizeNotes(rollingWindowRef.current, 2);
        setLiveNotes(stable);
      }, 80);
    } catch {
      // mic denied — continue without detection
    }
  }

  function flashResultMsg(type: FlashType) {
    setFlashResult(type);
    setTimeout(() => setFlashResult(null), 800);
  }

  function drawCanvas(timestamp: number) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (lastTimeRef.current !== null) {
      const delta = (timestamp - lastTimeRef.current) / 1000;
      scrollXRef.current += pixelsPerSec * delta;
    }
    lastTimeRef.current = timestamp;

    const n = availableChords.length;
    if (n === 0) return;

    ctx.clearRect(0, 0, canvas.width, CANVAS_HEIGHT);

    // Lane background
    ctx.fillStyle = "rgba(255,255,255,0.04)";
    ctx.beginPath();
    // @ts-ignore
    ctx.roundRect(0, LANE_Y, canvas.width, LANE_H, 8);
    ctx.fill();

    // Marker line
    ctx.strokeStyle = "#22d3ee";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(MARKER_X, LANE_Y);
    ctx.lineTo(MARKER_X, LANE_Y + LANE_H);
    ctx.stroke();

    // Determine which block is currently at the marker
    const newBlockIdx = Math.floor(scrollXRef.current / (BLOCK_WIDTH + BLOCK_GAP));
    const clampedIdx = Math.min(newBlockIdx, n - 1);

    if (clampedIdx !== currentBlockIdxRef.current) {
      // Block changed — score the previous block
      const prevIdx = currentBlockIdxRef.current;
      const matchRatio = totalFramesRef.current > 0
        ? matchFramesRef.current / totalFramesRef.current
        : 0;
      const result: BlockResult = matchRatio >= 0.7 ? "great" : matchRatio >= 0.35 ? "ok" : "miss";

      blockResultsRef.current = [...blockResultsRef.current];
      blockResultsRef.current[prevIdx] = result;
      setBlockResults([...blockResultsRef.current]);
      flashResultMsg(result === "great" ? "GREAT!" : result === "ok" ? "OK" : "MISS");

      // Reset counters
      matchFramesRef.current = 0;
      totalFramesRef.current = 0;
      currentBlockIdxRef.current = clampedIdx;
      setCurrentBlockIdx(clampedIdx);
    }

    // Draw blocks
    for (let i = 0; i < n; i++) {
      const blockLeft = i * (BLOCK_WIDTH + BLOCK_GAP) - scrollXRef.current + MARKER_X + BLOCK_WIDTH + BLOCK_GAP;
      if (blockLeft > canvas.width + BLOCK_WIDTH) continue;
      if (blockLeft < -BLOCK_WIDTH) continue;

      const isCurrent = i === clampedIdx;
      const result = blockResultsRef.current[i];

      // Block fill
      let fillColor = "rgba(124,58,237,0.25)";
      if (isCurrent) fillColor = "rgba(124,58,237,0.45)";
      if (result === "great") fillColor = "rgba(34,197,94,0.25)";
      else if (result === "ok") fillColor = "rgba(234,179,8,0.25)";
      else if (result === "miss") fillColor = "rgba(239,68,68,0.2)";

      ctx.fillStyle = fillColor;
      ctx.beginPath();
      // @ts-ignore
      ctx.roundRect(blockLeft, LANE_Y + 8, BLOCK_WIDTH, LANE_H - 16, 6);
      ctx.fill();

      // Border
      ctx.strokeStyle = isCurrent ? "#7c3aed" : "rgba(124,58,237,0.3)";
      ctx.lineWidth = isCurrent ? 1.5 : 1;
      ctx.stroke();

      // Result indicator
      if (result === "great") { ctx.strokeStyle = "#22c55e"; ctx.lineWidth = 1.5; ctx.stroke(); }
      else if (result === "ok") { ctx.strokeStyle = "#eab308"; ctx.lineWidth = 1.5; ctx.stroke(); }
      else if (result === "miss") { ctx.strokeStyle = "#ef4444"; ctx.lineWidth = 1.5; ctx.stroke(); }

      // Chord label
      ctx.fillStyle = isCurrent ? "#ffffff" : "rgba(255,255,255,0.7)";
      ctx.font = `${isCurrent ? "bold " : ""}16px system-ui`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(availableChords[i].symbol, blockLeft + BLOCK_WIDTH / 2, LANE_Y + LANE_H / 2);
    }

    // Update live note matching for current block
    if (analyserRef.current) {
      const buf = new Float32Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getFloatFrequencyData(buf);
      const peaks = detectPeaks(buf, audioCtxRef.current?.sampleRate ?? 22050, 2048);
      const notes = stabilizeNotes([...rollingWindowRef.current.slice(-2), peaks.map((p) => p.noteName)], 2);
      const expectedNotes = fingerings[availableChords[clampedIdx]?.chord_key ?? ""]?.notes ?? [];
      const matchCount = notes.filter((n) => expectedNotes.includes(n)).length;
      if (expectedNotes.length > 0) {
        totalFramesRef.current += 1;
        if (matchCount >= Math.ceil(expectedNotes.length * 0.5)) {
          matchFramesRef.current += 1;
        }
      }
    }

    // Loop detection: stop when all blocks have scrolled past
    const lastBlockRight = (n - 1) * (BLOCK_WIDTH + BLOCK_GAP) - scrollXRef.current + MARKER_X + BLOCK_WIDTH + BLOCK_GAP + BLOCK_WIDTH;
    if (lastBlockRight < 0 && isRunning) {
      // All done
    }

    if (isRunning) {
      rafRef.current = requestAnimationFrame(drawCanvas);
    }
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
    setIsRunning(true);
    rafRef.current = requestAnimationFrame(drawCanvas);
  }

  function handleStop() {
    setIsRunning(false);
    cancelAnimationFrame(rafRef.current);
    metControls.stop();
    closeMic();
  }

  function handleRepeat() {
    scrollXRef.current = 0;
    currentBlockIdxRef.current = 0;
    matchFramesRef.current = 0;
    totalFramesRef.current = 0;
    blockResultsRef.current = new Array(availableChords.length).fill(null);
    setBlockResults(new Array(availableChords.length).fill(null));
    setCurrentBlockIdx(0);
    lastTimeRef.current = null;
    if (!isRunning) {
      setIsRunning(true);
      rafRef.current = requestAnimationFrame(drawCanvas);
    }
  }

  const currentChord = availableChords[currentBlockIdx];
  const currentFingering = currentChord?.chord_key ? fingerings[currentChord.chord_key] : null;
  const expectedNotes = currentFingering?.notes ?? [];
  const matchCount = liveNotes.filter((n) => expectedNotes.includes(n)).length;
  const isOnChord = expectedNotes.length > 0 && matchCount >= Math.ceil(expectedNotes.length * 0.5);

  const flashColor = flashResult === "GREAT!" ? "#22c55e" : flashResult === "OK" ? "#eab308" : "#ef4444";

  if (availableChords.length === 0) {
    return (
      <div className="glass-card p-8 text-center space-y-4 max-w-xl mx-auto">
        <p className="gradient-text text-xl font-bold">Play Along</p>
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
          No app-supported chords found in this lesson. Practice individual chords first to unlock play-along mode.
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
          onClick={onClose}
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
          width={800}
          height={CANVAS_HEIGHT}
          className="w-full rounded-lg"
          style={{ background: "transparent" }}
        />
      </div>

      {/* Current chord + live detection */}
      <div className="flex justify-between items-start gap-4">
        <div className="glass-card p-4 flex-1 text-center">
          <p className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.4)" }}>Now Playing</p>
          <p className="gradient-text text-4xl font-black">{currentChord?.symbol ?? "—"}</p>
          {expectedNotes.length > 0 && (
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
              {liveNotes.length === 0 ? "🎸 Waiting..." : isOnChord ? "✓ On chord" : "Keep pressing"}
            </div>
          )}
        </div>

        {currentFingering && (
          <ChordDiagram fingering={currentFingering} liveNotes={liveNotes} />
        )}
      </div>

      {/* Flash result overlay */}
      {flashResult && (
        <div
          key={flashResult + Date.now()}
          className="fixed inset-0 flex items-center justify-center pointer-events-none z-50"
        >
          <div
            className="animate-flash-result text-6xl font-black"
            style={{ color: flashColor, textShadow: `0 0 40px ${flashColor}` }}
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

      {/* Song sections (if available) */}
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
