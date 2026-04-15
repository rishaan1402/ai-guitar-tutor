"use client";

import { useEffect, useRef, useState } from "react";
import CountdownOverlay from "./CountdownOverlay";
import { detectPeaks, stabilizeNotes } from "@/lib/noteDetection";

interface Props {
  onRecordingComplete: (blob: Blob) => void;
  disabled?: boolean;
  onLiveNotes?: (notes: string[]) => void;
}

const SAMPLE_RATE = 22050;
const BUFFER_SIZE = 4096;
const BAR_COUNT = 32;

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const numSamples = samples.length;
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, numSamples * 2, true);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }
  return new Blob([buffer], { type: "audio/wav" });
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function MicrophoneRecorder({ onRecordingComplete, disabled, onLiveNotes }: Props) {
  const [recording, setRecording] = useState(false);
  const [showCountdown, setShowCountdown] = useState(false);
  const [error, setError] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Float32Array[]>([]);
  const rafRef = useRef(0);
  const activeRef = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const liveNotesIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rollingWindowRef = useRef<string[][]>([]);

  // Canvas-based waveform with gradient
  useEffect(() => {
    function draw() {
      if (!activeRef.current) return;
      const analyser = analyserRef.current;
      const canvas = canvasRef.current;
      if (!analyser || !canvas) {
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const w = canvas.width;
      const h = canvas.height;

      const dataArray = new Uint8Array(analyser.fftSize);
      analyser.getByteTimeDomainData(dataArray);

      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "rgba(0,0,0,0)";
      ctx.fillRect(0, 0, w, h);

      const seg = Math.floor(dataArray.length / BAR_COUNT);
      const barW = (w - (BAR_COUNT - 1)) / BAR_COUNT;

      // Create horizontal gradient purple→cyan
      const gradient = ctx.createLinearGradient(0, 0, w, 0);
      gradient.addColorStop(0, "#a78bfa");
      gradient.addColorStop(0.5, "#38bdf8");
      gradient.addColorStop(1, "#22d3ee");

      for (let i = 0; i < BAR_COUNT; i++) {
        let sumSq = 0;
        for (let j = 0; j < seg; j++) {
          const v = (dataArray[i * seg + j] - 128) / 128;
          sumSq += v * v;
        }
        const rms = Math.sqrt(sumSq / seg);
        const level = Math.min(1, rms * 40);
        const barH = Math.max(3, level * h * 0.9);

        ctx.fillStyle = gradient;
        const x = i * (barW + 1);
        const y = (h - barH) / 2;
        ctx.beginPath();
        ctx.roundRect(x, y, barW, barH, 2);
        ctx.fill();
      }

      rafRef.current = requestAnimationFrame(draw);
    }

    if (recording) {
      rafRef.current = requestAnimationFrame(draw);
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [recording]);

  async function startRecording() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: SAMPLE_RATE,
          channelCount: 1,
        },
      });

      const audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(BUFFER_SIZE, 1, 1);

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.5;

      chunksRef.current = [];

      processor.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0);
        chunksRef.current.push(new Float32Array(input));
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
      setElapsedSeconds(0);
      setRecording(true);

      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);

      // Live note detection: poll analyser every 80ms
      if (onLiveNotes) {
        liveNotesIntervalRef.current = setInterval(() => {
          if (!analyserRef.current) return;
          const freqData = new Float32Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getFloatFrequencyData(freqData);
          const peaks = detectPeaks(freqData, SAMPLE_RATE, 2048);
          rollingWindowRef.current = [
            ...rollingWindowRef.current.slice(-2),
            peaks.map((p) => p.noteName),
          ];
          onLiveNotes(stabilizeNotes(rollingWindowRef.current, 2));
        }, 80);
      }
    } catch {
      setError("Microphone access denied. Please allow microphone permissions.");
    }
  }

  function stopRecording() {
    if (!activeRef.current) return;
    activeRef.current = false;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    if (liveNotesIntervalRef.current) {
      clearInterval(liveNotesIntervalRef.current);
      liveNotesIntervalRef.current = null;
    }
    onLiveNotes?.([]);

    processorRef.current?.disconnect();
    sourceRef.current?.disconnect();
    analyserRef.current?.disconnect();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    audioContextRef.current?.close();
    analyserRef.current = null;

    const totalLength = chunksRef.current.reduce((sum, c) => sum + c.length, 0);
    const merged = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of chunksRef.current) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }

    const wavBlob = encodeWav(merged, SAMPLE_RATE);
    onRecordingComplete(wavBlob);
    setRecording(false);
    setElapsedSeconds(0);
  }

  function handleRecordClick() {
    setShowCountdown(true);
  }

  function handleCountdownComplete() {
    setShowCountdown(false);
    startRecording();
  }

  return (
    <div className="flex flex-col gap-3">
      {showCountdown && <CountdownOverlay onComplete={handleCountdownComplete} />}

      <div className="flex gap-3 items-center">
        {!recording ? (
          <button
            onClick={handleRecordClick}
            disabled={disabled}
            className="glass flex items-center gap-2 text-red-300 border border-red-500/30 hover:bg-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed font-semibold rounded-xl px-5 py-2.5 transition-all"
            style={{ boxShadow: "0 0 12px rgba(239,68,68,0.15)" }}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
            Record
          </button>
        ) : (
          <button
            onClick={stopRecording}
            className="glass flex items-center gap-2 text-yellow-300 border border-yellow-500/30 hover:bg-yellow-500/20 font-semibold rounded-xl px-5 py-2.5 transition-all"
            style={{ boxShadow: "0 0 12px rgba(245,158,11,0.15)" }}
          >
            <span className="w-2.5 h-2.5 rounded-sm bg-yellow-400" />
            Stop
          </button>
        )}

        {recording && (
          <div className="flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-full bg-red-500"
              style={{ animation: "recording-pulse 1s ease-in-out infinite" }}
            />
            <span className="text-red-400 text-sm font-medium tabular-nums">
              {formatTime(elapsedSeconds)}
            </span>
            <span className="text-gray-400 text-sm">— play now!</span>
          </div>
        )}
      </div>

      {recording && (
        <div
          className="glass rounded-xl overflow-hidden p-2"
          style={{ animation: "fade-in-up 0.2s ease-out both" }}
        >
          <canvas
            ref={canvasRef}
            width={400}
            height={48}
            className="w-full h-12 rounded-lg"
            style={{ background: "transparent" }}
          />
        </div>
      )}

      {error && <p className="text-red-400 text-sm">{error}</p>}
    </div>
  );
}
