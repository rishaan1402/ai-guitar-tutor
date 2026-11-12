"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import RingButton from "./stage/RingButton";
import { detectPeaks, stabilizeNotes } from "@/lib/noteDetection";
import {
  AutoStopDetector,
  CLIP_DBFS,
  DB_FLOOR,
  PrerollBuffer,
  TOO_QUIET_DBFS,
  dbfsToLevel,
  encodeWav,
  frameStats,
  levelHint,
  mergeChunks,
  prerollFrameCount,
  sameNotes,
  toDbfs,
  type LevelHint,
  type StopReason,
} from "@/lib/audioCapture";
import { COPY, LIVE_HINT } from "@/lib/feedbackCopy";
import { useReducedMotion } from "@/lib/motion";
import { useCoarsePointer } from "@/lib/usePointer";
import { isActivationKey, isInteractiveTarget } from "@/lib/hotkeys";

/** idle → (press) opening → armed (mic live, waiting for the strum) → recording → idle. */
export type RecorderPhase = "idle" | "opening" | "armed" | "recording";

interface Props {
  onRecordingComplete: (blob: Blob) => void;
  disabled?: boolean;
  onLiveNotes?: (notes: string[]) => void;
  /** Bind Space / Enter to record/stop and Esc to cancel (ignored while typing or on other controls). */
  hotkeys?: boolean;
  size?: number;
  /** Receives a dedicated fftSize-8192 analyser while the mic is open (null when closed). */
  onAnalyser?: (an: AnalyserNode | null) => void;
  onPhase?: (phase: RecorderPhase) => void;
  /** A take was dropped because nothing (or almost nothing) was heard. Not uploaded. */
  onSilentTake?: () => void;
  /** Show the built-in level meter (off when a listening stage replaces it). */
  meter?: boolean;
}

const BUFFER_SIZE = 2048;
/** Recording cap, measured from the onset. */
const MAX_SECONDS = 6;
/** Give up waiting for a strum after this long armed. */
const ARM_TIMEOUT_SECONDS = 8;
/** Audio kept from before the onset. */
const PREROLL_SECONDS = 0.25;
const IGNORE_SECONDS = 0.3;
const SUSTAIN_FRAMES = 3;
const BAR_PX = 3;
const GAP_PX = 1;
/** "Good level" band drawn behind the meter. */
const GOOD_LOW_DB = -30;
const GOOD_HIGH_DB = -6;

function formatTime(seconds: number): string {
  const s = Math.min(MAX_SECONDS, Math.floor(seconds));
  return `0:${s.toString().padStart(2, "0")}`;
}

export default function MicrophoneRecorder({
  onRecordingComplete,
  disabled,
  onLiveNotes,
  hotkeys = true,
  size = 148,
  onAnalyser,
  onPhase,
  onSilentTake,
  meter = true,
}: Props) {
  const reduceMotion = useReducedMotion();
  const coarse = useCoarsePointer();
  const [phase, setPhaseState] = useState<RecorderPhase>("idle");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [hint, setHint] = useState<LevelHint>(null);

  const phaseRef = useRef<RecorderPhase>("idle");
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const stageAnalyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Float32Array[]>([]);
  const samplesRef = useRef(0);
  /** Sample peak since the mic opened (hints) and over the recorded take (upload guard). */
  const peakRef = useRef(0);
  const takePeakRef = useRef(0);
  const recStartRef = useRef(0);
  const hintRef = useRef<LevelHint>(null);
  const historyRef = useRef<number[]>([]);
  const rafRef = useRef(0);
  const openTokenRef = useRef(0);
  const mountedRef = useRef(true);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const liveNotesIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rollingWindowRef = useRef<string[][]>([]);
  const lastNotesRef = useRef<string[]>([]);
  const onLiveNotesRef = useRef(onLiveNotes);
  onLiveNotesRef.current = onLiveNotes;
  const onCompleteRef = useRef(onRecordingComplete);
  onCompleteRef.current = onRecordingComplete;
  const onAnalyserRef = useRef(onAnalyser);
  onAnalyserRef.current = onAnalyser;
  const onSilentRef = useRef(onSilentTake);
  onSilentRef.current = onSilentTake;
  const onPhaseRef = useRef(onPhase);
  onPhaseRef.current = onPhase;

  const setPhase = useCallback((p: RecorderPhase) => {
    phaseRef.current = p;
    setPhaseState(p);
    onPhaseRef.current?.(p);
  }, []);

  /** Release every audio resource. Safe to call repeatedly; never emits a recording. */
  const teardown = useCallback(() => {
    openTokenRef.current++;
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
    stageAnalyserRef.current?.disconnect();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    const ctx = audioContextRef.current;
    if (ctx && ctx.state !== "closed") ctx.close().catch(() => {});
    if (stageAnalyserRef.current) onAnalyserRef.current?.(null);

    processorRef.current = null;
    sourceRef.current = null;
    analyserRef.current = null;
    stageAnalyserRef.current = null;
    streamRef.current = null;
    audioContextRef.current = null;
    chunksRef.current = [];
    if (lastNotesRef.current.length) {
      lastNotesRef.current = [];
      onLiveNotesRef.current?.([]);
    }
  }, []);

  /** End the take. Uploads only a real recording that got above the too-quiet floor. */
  const finish = useCallback(
    (reason: StopReason | "user" | "cancel") => {
      const p = phaseRef.current;
      if (p === "idle") return;
      const sampleRate = audioContextRef.current?.sampleRate ?? 48000;
      const chunks = chunksRef.current;
      const recorded = p === "recording";
      const loudEnough = toDbfs(takePeakRef.current) >= TOO_QUIET_DBFS;
      teardown();
      setPhase("idle");
      setElapsed(0);
      setHint(null);
      hintRef.current = null;

      if (reason === "cancel" || (reason === "user" && !recorded)) return;
      if (reason === "silent" || !recorded || !loudEnough) {
        setNotice(COPY.micCheck);
        onSilentRef.current?.();
        requestAnimationFrame(() => buttonRef.current?.focus());
        return;
      }
      onCompleteRef.current(encodeWav(mergeChunks(chunks), sampleRate));
    },
    [teardown, setPhase],
  );

  // Full teardown on unmount (navigating away mid-recording must free the mic).
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      teardown();
    };
  }, [teardown]);

  const drawIdle = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth || 300;
    const cssH = canvas.clientHeight || 48;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const yFor = (db: number) => cssH - dbfsToLevel(db) * cssH;
    ctx.clearRect(0, 0, cssW, cssH);
    ctx.fillStyle = "rgba(163,198,171,0.10)";
    ctx.fillRect(0, yFor(GOOD_HIGH_DB), cssW, yFor(GOOD_LOW_DB) - yFor(GOOD_HIGH_DB));
    ctx.fillStyle = "rgba(243,234,216,0.35)";
    ctx.fillRect(0, cssH - 1.5, cssW, 1.5);
  }, []);

  // Idle meter: a flat line and the target band, so the box doesn't read as broken.
  useEffect(() => {
    if (meter && phase === "idle") drawIdle();
  }, [meter, phase, drawIdle]);

  // Scrolling dBFS level meter + level hints while the mic is open.
  useEffect(() => {
    if (phase !== "armed" && phase !== "recording") return;

    function draw() {
      if (phaseRef.current !== "armed" && phaseRef.current !== "recording") return;
      const analyser = analyserRef.current;
      const canvas = canvasRef.current;
      const sr = audioContextRef.current?.sampleRate || 48000;
      const t = samplesRef.current / sr;
      if (analyser && canvas && meter) {
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
          const yFor = (db: number) => cssH - dbfsToLevel(db) * cssH;
          ctx.fillStyle = "rgba(163,198,171,0.10)";
          ctx.fillRect(0, yFor(GOOD_HIGH_DB), cssW, yFor(GOOD_LOW_DB) - yFor(GOOD_HIGH_DB));
          ctx.fillStyle = "rgba(222,122,92,0.55)";
          ctx.fillRect(0, yFor(CLIP_DBFS), cssW, 1);

          // Colour by the take's running peak: a healthy strum's decay tail is
          // neutral, and amber only means "still too quiet after 1.5 s".
          const peakGood = toDbfs(peakRef.current) >= GOOD_LOW_DB;
          const bars = reduceMotion ? [level] : hist;
          const barW = reduceMotion ? cssW : BAR_PX;
          const startX = reduceMotion ? 0 : cssW - bars.length * (BAR_PX + GAP_PX);
          for (let i = 0; i < bars.length; i++) {
            const l = bars[i];
            const h = Math.max(1, l * cssH);
            const db = DB_FLOOR * (1 - l);
            ctx.fillStyle =
              db > CLIP_DBFS - 2
                ? "#de7a5c"
                : db >= GOOD_LOW_DB
                ? "#a3c6ab"
                : peakGood || t < 1.5
                ? "rgba(243,234,216,0.5)"
                : "#efc27a";
            ctx.fillRect(startX + i * (BAR_PX + GAP_PX), cssH - h, barW, h);
          }
        }
      }
      // While waiting for the strum only warn about clipping: "too quiet" before
      // anyone has played would blame the learner for not having strummed yet.
      const raw = levelHint(toDbfs(peakRef.current), t);
      const next = phaseRef.current === "armed" && raw !== "clipping" ? null : raw;
      if (next !== hintRef.current) {
        hintRef.current = next;
        setHint(next);
      }
      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [phase, reduceMotion, meter]);

  /** Press: open the mic now (context first, then stream — iOS-safe) and wait for the strum. */
  const arm = useCallback(async () => {
    if (phaseRef.current !== "idle") return;
    setError("");
    setNotice(null);
    setPhase("opening");
    const token = ++openTokenRef.current;

    let audioContext: AudioContext;
    try {
      audioContext = new AudioContext();
      audioContext.resume?.().catch(() => {});
    } catch {
      setPhase("idle");
      setError("Couldn't start audio capture in this browser.");
      return;
    }

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
      audioContext.close().catch(() => {});
      if (token !== openTokenRef.current || !mountedRef.current) return;
      const name = err instanceof DOMException ? err.name : "";
      setPhase("idle");
      setError(
        name === "NotFoundError"
          ? "No microphone found. Plug one in and try again."
          : "Microphone access denied. Please allow microphone permissions.",
      );
      return;
    }
    // Cancelled (Esc / unmount) while the permission prompt was up.
    if (token !== openTokenRef.current || !mountedRef.current) {
      stream.getTracks().forEach((t) => t.stop());
      audioContext.close().catch(() => {});
      return;
    }

    try {
      const sr = audioContext.sampleRate;
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(BUFFER_SIZE, 1, 1);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.5;
      let stageAnalyser: AnalyserNode | null = null;
      if (onAnalyserRef.current) {
        stageAnalyser = audioContext.createAnalyser();
        stageAnalyser.fftSize = 8192;
        stageAnalyser.smoothingTimeConstant = 0;
        source.connect(stageAnalyser);
      }

      const detector = new AutoStopDetector({
        maxSeconds: ARM_TIMEOUT_SECONDS + MAX_SECONDS,
        maxAfterArmSeconds: MAX_SECONDS,
        noStrumSeconds: ARM_TIMEOUT_SECONDS,
        ignoreSeconds: IGNORE_SECONDS,
        sustainFrames: SUSTAIN_FRAMES,
      });
      const prerollFrames = prerollFrameCount(PREROLL_SECONDS, sr, BUFFER_SIZE);
      const preroll = new PrerollBuffer(
        prerollFrames + prerollFrameCount(IGNORE_SECONDS, sr, BUFFER_SIZE) + SUSTAIN_FRAMES + 2,
      );
      chunksRef.current = [];
      samplesRef.current = 0;
      peakRef.current = 0;
      takePeakRef.current = 0;
      hintRef.current = null;
      historyRef.current = [];

      processor.onaudioprocess = (e) => {
        const p = phaseRef.current;
        if (p !== "armed" && p !== "recording") return;
        const input = new Float32Array(e.inputBuffer.getChannelData(0));
        samplesRef.current += input.length;
        const t = samplesRef.current / sr;
        const { rms, peak } = frameStats(input);
        if (peak > peakRef.current) peakRef.current = peak;

        if (p === "armed") {
          preroll.push(input);
          const why = detector.update(rms, t);
          if (detector.armed) {
            // Onset: the take starts 250 ms before the run of loud frames that armed us,
            // so a key/mouse click well before the strum never reaches the WAV.
            const frames = preroll.snapshot(detector.loudRun + prerollFrames);
            preroll.clear();
            chunksRef.current = frames;
            takePeakRef.current = Math.max(...frames.map((f) => frameStats(f).peak));
            recStartRef.current = t;
            setPhase("recording");
          }
          if (why) finish(why);
          return;
        }

        chunksRef.current.push(input);
        if (peak > takePeakRef.current) takePeakRef.current = peak;
        const why = detector.update(rms, t);
        if (why) finish(why);
      };

      source.connect(analyser);
      source.connect(processor);
      processor.connect(audioContext.destination);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      stageAnalyserRef.current = stageAnalyser;
      sourceRef.current = source;
      processorRef.current = processor;
      streamRef.current = stream;
      rollingWindowRef.current = [];
      lastNotesRef.current = [];
      setElapsed(0);
      setHint(null);
      setPhase("armed");
      if (stageAnalyser) onAnalyserRef.current?.(stageAnalyser);

      timerRef.current = setInterval(() => {
        if (phaseRef.current === "recording") setElapsed(samplesRef.current / sr - recStartRef.current);
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
      setPhase("idle");
      setError("Couldn't start audio capture in this browser.");
    }
  }, [finish, setPhase, teardown]);

  const cancel = useCallback(() => {
    if (phaseRef.current === "opening") {
      openTokenRef.current++;
      setPhase("idle");
      return;
    }
    finish("cancel");
  }, [finish, setPhase]);

  const onButton = useCallback(() => {
    const p = phaseRef.current;
    if (p === "recording") finish("user");
    else if (p === "armed" || p === "opening") cancel();
    else if (!disabled) arm();
  }, [disabled, arm, cancel, finish]);

  useEffect(() => {
    if (!hotkeys) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && phaseRef.current !== "idle") {
        e.preventDefault();
        cancel();
        return;
      }
      if (!isActivationKey(e)) return;
      if (isInteractiveTarget(e.target)) return; // native activation handles buttons
      e.preventDefault();
      onButton();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hotkeys, onButton, cancel]);

  const listening = phase === "armed" || phase === "opening";
  const recording = phase === "recording";
  const cancelHint = coarse || !hotkeys ? "tap to cancel" : "Esc to cancel";

  return (
    <div className="flex flex-col items-center gap-3" data-phase={phase}>
      <RingButton
        variant="primary"
        buttonRef={buttonRef}
        label={recording ? "Stop" : listening ? "Listening" : "Record"}
        sublabel={recording ? `${formatTime(elapsed)} / 0:0${MAX_SECONDS}` : listening ? cancelHint : undefined}
        onClick={onButton}
        disabled={phase === "idle" && disabled}
        active={recording}
        listening={listening}
        progress={recording ? 1 - elapsed / MAX_SECONDS : undefined}
        size={size}
        ariaLabel={recording ? "Stop recording" : listening ? "Cancel — listening for your strum" : "Record your chord"}
        ariaPressed={recording || listening}
      />

      <p className="text-xs text-gray-400 text-center min-h-[1rem]" aria-live="polite">
        {recording
          ? "Let it ring — stops automatically."
          : listening
          ? "Strum when ready — I'm listening."
          : notice
          ? ""
          : hotkeys && !coarse
          ? "Press Record or hit Space, then strum once."
          : "Press Record, then strum once."}
      </p>

      {notice && phase === "idle" && (
        <p
          className="w-full max-w-sm text-sm text-center text-cream/90 rounded-xl border border-amber-300/30 bg-amber-300/[0.06] px-3 py-2"
          role="status"
          data-testid="mic-check"
        >
          {notice}
        </p>
      )}

      {meter ? (
        <div className="w-full max-w-sm">
          <div className="glass rounded-xl overflow-hidden px-2 py-1.5">
            <canvas
              ref={canvasRef}
              className="block w-full h-12"
              role="img"
              aria-label="Input level meter"
              style={{ opacity: phase === "idle" ? 0.55 : 1 }}
            />
          </div>
          <p
            className={`mt-1.5 text-xs text-center min-h-[1rem] ${hint === "clipping" ? "text-[#de7a5c]" : "text-amber-300"}`}
            role="status"
          >
            {phase !== "idle" && hint ? LIVE_HINT[hint] : phase === "idle" ? <span className="text-gray-500">Input level</span> : ""}
          </p>
        </div>
      ) : (
        <p
          className={`text-xs text-center min-h-[1rem] ${hint === "clipping" ? "text-[#de7a5c]" : "text-amber-300"}`}
          role="status"
        >
          {phase !== "idle" && hint ? LIVE_HINT[hint] : ""}
        </p>
      )}

      {error && (
        <p className="text-red-400 text-sm text-center" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
