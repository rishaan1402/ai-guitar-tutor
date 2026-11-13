"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import RingButton from "./stage/RingButton";
import { detectPeaks, stabilizeNotes } from "@/lib/noteDetection";
import {
  AutoStopDetector,
  CLIP_DBFS,
  DB_FLOOR,
  GapDetector,
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
import { micErrorMessage, openMic } from "@/lib/mic";
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
  /** A take was dropped because the device skipped audio (busy main thread). Not uploaded. */
  onDroppedTake?: () => void;
  /** Reuse an already-open mic stream (onboarding); it is not stopped on teardown. */
  stream?: MediaStream | null;
  /** Show the built-in level meter (off when a listening stage replaces it). */
  meter?: boolean;
}

const BUFFER_SIZE = 2048;
/** AudioWorklet capture processor (public/worklets/capture.js). */
const WORKLET_URL = "/worklets/capture.js";
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
  onDroppedTake,
  stream: sharedStream = null,
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
  const workletRef = useRef<AudioWorkletNode | null>(null);
  /** Audio went missing during this take (gap in the block clock): don't upload it. */
  const droppedRef = useRef(false);
  const sharedStreamRef = useRef<MediaStream | null>(sharedStream);
  sharedStreamRef.current = sharedStream;
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
  const onDroppedRef = useRef(onDroppedTake);
  onDroppedRef.current = onDroppedTake;
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
    const worklet = workletRef.current;
    if (worklet) {
      worklet.port.onmessage = null;
      try {
        worklet.port.postMessage("stop");
        worklet.port.close();
      } catch {
        // already closed
      }
      worklet.disconnect();
    }
    sourceRef.current?.disconnect();
    analyserRef.current?.disconnect();
    stageAnalyserRef.current?.disconnect();
    if (streamRef.current && streamRef.current !== sharedStreamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
    const ctx = audioContextRef.current;
    if (ctx && ctx.state !== "closed") ctx.close().catch(() => {});
    if (stageAnalyserRef.current) onAnalyserRef.current?.(null);

    processorRef.current = null;
    workletRef.current = null;
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
      const dropped = droppedRef.current;
      droppedRef.current = false;
      teardown();
      setPhase("idle");
      setElapsed(0);
      setHint(null);
      hintRef.current = null;

      if (reason === "cancel" || (reason === "user" && !recorded)) return;
      if (recorded && dropped) {
        // Part of the take never reached us; grading it would be unfair.
        setNotice(COPY.deviceBusy);
        onDroppedRef.current?.();
        requestAnimationFrame(() => buttonRef.current?.focus());
        return;
      }
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
      const shared = sharedStreamRef.current;
      stream =
        shared && shared.getAudioTracks?.().some((t) => t.readyState === "live")
          ? shared
          : await openMic();
    } catch (err) {
      audioContext.close().catch(() => {});
      if (token !== openTokenRef.current || !mountedRef.current) return;
      setPhase("idle");
      setError(micErrorMessage(err));
      return;
    }
    // Cancelled (Esc / unmount) while the permission prompt was up.
    if (token !== openTokenRef.current || !mountedRef.current) {
      if (stream !== sharedStreamRef.current) stream.getTracks().forEach((t) => t.stop());
      audioContext.close().catch(() => {});
      return;
    }

    // Capture on the audio thread where supported (no dropouts under main-thread load).
    let worklet: AudioWorkletNode | null = null;
    if (audioContext.audioWorklet && typeof AudioWorkletNode !== "undefined") {
      try {
        await audioContext.audioWorklet.addModule(WORKLET_URL);
        worklet = new AudioWorkletNode(audioContext, "agt-capture", {
          numberOfInputs: 1,
          numberOfOutputs: 1,
          channelCount: 1,
          channelCountMode: "explicit",
        });
      } catch {
        worklet = null; // fall back to ScriptProcessor
      }
      if (token !== openTokenRef.current || !mountedRef.current) {
        worklet?.disconnect();
        if (stream !== sharedStreamRef.current) stream.getTracks().forEach((t) => t.stop());
        audioContext.close().catch(() => {});
        return;
      }
    }

    try {
      const sr = audioContext.sampleRate;
      const source = audioContext.createMediaStreamSource(stream);
      const processor = worklet ? null : audioContext.createScriptProcessor(BUFFER_SIZE, 1, 1);
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

      const gaps = new GapDetector();
      droppedRef.current = false;

      /** One block of mic audio, from the worklet or the ScriptProcessor. */
      const onBlock = (input: Float32Array, startFrame: number | null) => {
        const p = phaseRef.current;
        if (p !== "armed" && p !== "recording") return;
        const gap = gaps.push(startFrame, input.length);
        if (gap > 0) {
          if (p === "recording") droppedRef.current = true;
          // While armed, start the pre-roll afresh so a take never spans the gap.
          else preroll.clear();
        }
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

      if (worklet) {
        worklet.port.onmessage = (e: MessageEvent<{ frame: number; buf: Float32Array }>) => {
          onBlock(e.data.buf, e.data.frame);
        };
        source.connect(worklet);
        worklet.connect(audioContext.destination);
      } else if (processor) {
        processor.onaudioprocess = (e) => {
          const pt = (e as AudioProcessingEvent).playbackTime;
          onBlock(
            new Float32Array(e.inputBuffer.getChannelData(0)),
            typeof pt === "number" && pt > 0 ? pt * sr : null,
          );
        };
        source.connect(processor);
        processor.connect(audioContext.destination);
      }

      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      stageAnalyserRef.current = stageAnalyser;
      sourceRef.current = source;
      processorRef.current = processor;
      workletRef.current = worklet;
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
      if (stream !== sharedStreamRef.current) stream.getTracks().forEach((t) => t.stop());
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
