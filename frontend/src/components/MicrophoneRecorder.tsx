"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import CountdownOverlay from "./CountdownOverlay";
import RingButton from "./stage/RingButton";
import { detectPeaks, stabilizeNotes } from "@/lib/noteDetection";
import {
  AutoStopDetector,
  CLIP_DBFS,
  DB_FLOOR,
  dbfsToLevel,
  encodeWav,
  frameStats,
  levelHint,
  mergeChunks,
  sameNotes,
  toDbfs,
  type LevelHint,
} from "@/lib/audioCapture";
import { useReducedMotion } from "@/lib/motion";
import { isActivationKey, isInteractiveTarget } from "@/lib/hotkeys";

interface Props {
  onRecordingComplete: (blob: Blob) => void;
  disabled?: boolean;
  onLiveNotes?: (notes: string[]) => void;
  /** Bind Space / Enter to record/stop (ignored while typing or on other controls). */
  hotkeys?: boolean;
  size?: number;
}

const BUFFER_SIZE = 2048;
const MAX_SECONDS = 6;
const BAR_PX = 3;
const GAP_PX = 1;
/** "Good level" band drawn behind the meter. */
const GOOD_LOW_DB = -30;
const GOOD_HIGH_DB = -6;

const HINT_TEXT: Record<Exclude<LevelHint, null>, string> = {
  too_quiet: "Too quiet — move closer to the mic or strum harder.",
  clipping: "Clipping — back off from the mic a little.",
};

function formatTime(seconds: number): string {
  const s = Math.floor(seconds);
  return `0:${s.toString().padStart(2, "0")}`;
}

export default function MicrophoneRecorder({
  onRecordingComplete,
  disabled,
  onLiveNotes,
  hotkeys = true,
  size = 148,
}: Props) {
  const reduceMotion = useReducedMotion();
  const [recording, setRecording] = useState(false);
  const [showCountdown, setShowCountdown] = useState(false);
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [hint, setHint] = useState<LevelHint>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Float32Array[]>([]);
  const samplesRef = useRef(0);
  const peakRef = useRef(0);
  const hintRef = useRef<LevelHint>(null);
  const historyRef = useRef<number[]>([]);
  const rafRef = useRef(0);
  const activeRef = useRef(false);
  const mountedRef = useRef(true);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const liveNotesIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rollingWindowRef = useRef<string[][]>([]);
  const lastNotesRef = useRef<string[]>([]);
  const onLiveNotesRef = useRef(onLiveNotes);
  onLiveNotesRef.current = onLiveNotes;
  const onCompleteRef = useRef(onRecordingComplete);
  onCompleteRef.current = onRecordingComplete;

  /** Release every audio resource. Safe to call repeatedly; never emits a recording. */
  const teardown = useCallback(() => {
    activeRef.current = false;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    if (liveNotesIntervalRef.current) clearInterval(liveNotesIntervalRef.current);
    liveNotesIntervalRef.current = null;

    const processor = processorRef.current;
    if (processor) {
      processor.onaudioprocess = null;
      processor.disconnect();
    }
    sourceRef.current?.disconnect();
    analyserRef.current?.disconnect();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    const ctx = audioContextRef.current;
    if (ctx && ctx.state !== "closed") ctx.close().catch(() => {});

    processorRef.current = null;
    sourceRef.current = null;
    analyserRef.current = null;
    streamRef.current = null;
    audioContextRef.current = null;
  }, []);

  const stopRecording = useCallback(() => {
    if (!activeRef.current) return;
    const sampleRate = audioContextRef.current?.sampleRate ?? 48000;
    const chunks = chunksRef.current;
    chunksRef.current = [];
    teardown();
    if (lastNotesRef.current.length) {
      lastNotesRef.current = [];
      onLiveNotesRef.current?.([]);
    }
    setRecording(false);
    setElapsed(0);
    onCompleteRef.current(encodeWav(mergeChunks(chunks), sampleRate));
  }, [teardown]);

  // Full teardown on unmount (navigating away mid-recording must free the mic).
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      teardown();
    };
  }, [teardown]);

  // Scrolling dBFS level meter.
  useEffect(() => {
    if (!recording) return;

    function draw() {
      if (!activeRef.current) return;
      const analyser = analyserRef.current;
      const canvas = canvasRef.current;
      if (analyser && canvas) {
        const dpr = window.devicePixelRatio || 1;
        const cssW = canvas.clientWidth || 300;
        const cssH = canvas.clientHeight || 48;
        if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
          canvas.width = Math.round(cssW * dpr);
          canvas.height = Math.round(cssH * dpr);
        }
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          const frame = new Float32Array(analyser.fftSize);
          analyser.getFloatTimeDomainData(frame);
          const { rms } = frameStats(frame);
          const level = dbfsToLevel(toDbfs(rms));

          const maxBars = Math.max(1, Math.floor(cssW / (BAR_PX + GAP_PX)));
          const hist = historyRef.current;
          hist.push(level);
          if (hist.length > maxBars) hist.splice(0, hist.length - maxBars);

          ctx.clearRect(0, 0, cssW, cssH);
          // Target band
          const yFor = (db: number) => cssH - dbfsToLevel(db) * cssH;
          ctx.fillStyle = "rgba(163,198,171,0.10)";
          ctx.fillRect(0, yFor(GOOD_HIGH_DB), cssW, yFor(GOOD_LOW_DB) - yFor(GOOD_HIGH_DB));
          // Clip line
          ctx.fillStyle = "rgba(222,122,92,0.55)";
          ctx.fillRect(0, yFor(CLIP_DBFS), cssW, 1);

          const bars = reduceMotion ? [level] : hist;
          const barW = reduceMotion ? cssW : BAR_PX;
          const startX = reduceMotion ? 0 : cssW - bars.length * (BAR_PX + GAP_PX);
          for (let i = 0; i < bars.length; i++) {
            const l = bars[i];
            const h = Math.max(1, l * cssH);
            const db = DB_FLOOR * (1 - l);
            ctx.fillStyle = db > CLIP_DBFS - 2 ? "#de7a5c" : db >= GOOD_LOW_DB ? "#a3c6ab" : "#efc27a";
            ctx.fillRect(startX + i * (BAR_PX + GAP_PX), cssH - h, barW, h);
          }
        }

        const peakDb = toDbfs(peakRef.current);
        const t = samplesRef.current / (audioContextRef.current?.sampleRate || 48000);
        const next = levelHint(peakDb, t);
        if (next !== hintRef.current) {
          hintRef.current = next;
          setHint(next);
        }
      }
      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [recording, reduceMotion]);

  async function startRecording() {
    setError("");
    let stream: MediaStream;
    try {
      // No sampleRate constraint: use the device's native rate and encode at it.
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 1,
        },
      });
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      setError(
        name === "NotFoundError"
          ? "No microphone found. Plug one in and try again."
          : "Microphone access denied. Please allow microphone permissions.",
      );
      return;
    }
    if (!mountedRef.current) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }

    try {
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(BUFFER_SIZE, 1, 1);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.5;

      const detector = new AutoStopDetector({ maxSeconds: MAX_SECONDS });
      chunksRef.current = [];
      samplesRef.current = 0;
      peakRef.current = 0;
      hintRef.current = null;
      historyRef.current = [];

      processor.onaudioprocess = (e) => {
        if (!activeRef.current) return;
        const input = e.inputBuffer.getChannelData(0);
        chunksRef.current.push(new Float32Array(input));
        samplesRef.current += input.length;
        const { rms, peak } = frameStats(input);
        if (peak > peakRef.current) peakRef.current = peak;
        if (detector.update(rms, samplesRef.current / audioContext.sampleRate)) {
          stopRecording();
        }
      };

      source.connect(analyser);
      source.connect(processor);
      processor.connect(audioContext.destination);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      sourceRef.current = source;
      processorRef.current = processor;
      streamRef.current = stream;
      activeRef.current = true;
      rollingWindowRef.current = [];
      lastNotesRef.current = [];
      setElapsed(0);
      setHint(null);
      setRecording(true);

      const startedAt = performance.now();
      timerRef.current = setInterval(() => {
        setElapsed((performance.now() - startedAt) / 1000);
      }, 250);

      if (onLiveNotesRef.current) {
        liveNotesIntervalRef.current = setInterval(() => {
          const an = analyserRef.current;
          const ctx = audioContextRef.current;
          if (!an || !ctx) return;
          const freqData = new Float32Array(an.frequencyBinCount);
          an.getFloatFrequencyData(freqData);
          const peaks = detectPeaks(freqData, ctx.sampleRate, an.fftSize, -52, 8);
          rollingWindowRef.current = [...rollingWindowRef.current.slice(-2), peaks.map((p) => p.noteName)];
          const notes = stabilizeNotes(rollingWindowRef.current, 1);
          if (!sameNotes(notes, lastNotesRef.current)) {
            lastNotesRef.current = notes;
            onLiveNotesRef.current?.(notes);
          }
        }, 80);
      }
    } catch {
      stream.getTracks().forEach((t) => t.stop());
      teardown();
      setError("Couldn't start audio capture in this browser.");
    }
  }

  const handleRecordClick = useCallback(() => {
    setError("");
    setShowCountdown(true);
  }, []);

  const handleCountdownComplete = useCallback(() => {
    setShowCountdown(false);
    startRecording();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = useCallback(() => {
    if (activeRef.current) stopRecording();
    else if (!disabled && !showCountdown) handleRecordClick();
  }, [disabled, showCountdown, stopRecording, handleRecordClick]);

  useEffect(() => {
    if (!hotkeys) return;
    function onKey(e: KeyboardEvent) {
      if (showCountdown && e.key === "Escape") {
        setShowCountdown(false);
        return;
      }
      if (!isActivationKey(e)) return;
      if (isInteractiveTarget(e.target)) return; // native activation handles buttons
      e.preventDefault();
      toggle();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hotkeys, toggle, showCountdown]);

  return (
    <div className="flex flex-col items-center gap-3">
      {showCountdown && <CountdownOverlay onComplete={handleCountdownComplete} />}

      <RingButton
        label={recording ? "Stop" : "Record"}
        sublabel={recording ? `${formatTime(elapsed)} / 0:0${MAX_SECONDS}` : undefined}
        onClick={recording ? stopRecording : handleRecordClick}
        disabled={!recording && (disabled || showCountdown)}
        active={recording}
        size={size}
        ariaLabel={recording ? "Stop recording" : "Record your chord"}
        ariaPressed={recording}
      />

      <p className="text-xs text-gray-400 text-center min-h-[1rem]" aria-live="polite">
        {recording
          ? "Strum once and let it ring — stops automatically."
          : showCountdown
          ? "Get ready… (Esc to cancel)"
          : hotkeys
          ? "Press Record or hit Space, then strum once."
          : "Press Record, then strum once."}
      </p>

      <div className="w-full max-w-sm">
        <div className="glass rounded-xl overflow-hidden px-2 py-1.5">
          <canvas
            ref={canvasRef}
            className="block w-full h-12"
            role="img"
            aria-label="Input level meter"
            style={{ opacity: recording ? 1 : 0.35 }}
          />
        </div>
        <p
          className={`mt-1.5 text-xs text-center min-h-[1rem] ${hint === "clipping" ? "text-[#de7a5c]" : "text-amber-300"}`}
          role="status"
        >
          {recording && hint ? HINT_TEXT[hint] : ""}
        </p>
      </div>

      {error && (
        <p className="text-red-400 text-sm text-center" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
