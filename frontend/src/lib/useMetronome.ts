"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface MetronomeState {
  isRunning: boolean;
  currentBeat: number; // 1-indexed
  bpm: number;
  beatsPerBar: number;
}

export interface MetronomeControls {
  start: () => void;
  stop: () => void;
  setBpm: (bpm: number) => void;
  setBeatsPerBar: (beats: number) => void;
  tap: () => void;
}

function clampBpm(bpm: number): number {
  return Math.max(40, Math.min(220, Math.round(bpm)));
}

/** Play a single metronome click using Web Audio API. */
function playClick(ctx: AudioContext, isAccent: boolean) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.frequency.value = isAccent ? 1200 : 800;
  gain.gain.setValueAtTime(isAccent ? 0.4 : 0.25, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);

  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.05);
}

export function useMetronome(initialBpm = 80, initialBeatsPerBar = 4): [MetronomeState, MetronomeControls] {
  const [isRunning, setIsRunning] = useState(false);
  const [currentBeat, setCurrentBeat] = useState(1);
  const [bpm, setBpmState] = useState(clampBpm(initialBpm));
  const [beatsPerBar, setBeatsPerBarState] = useState(initialBeatsPerBar);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentBeatRef = useRef(1);
  const bpmRef = useRef(bpm);
  const beatsPerBarRef = useRef(beatsPerBar);
  const tapTimesRef = useRef<number[]>([]);

  // Keep refs in sync
  useEffect(() => { bpmRef.current = bpm; }, [bpm]);
  useEffect(() => { beatsPerBarRef.current = beatsPerBar; }, [beatsPerBar]);

  const stopTicking = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startTicking = useCallback(() => {
    stopTicking();
    const intervalMs = (60 / bpmRef.current) * 1000;

    intervalRef.current = setInterval(() => {
      if (!audioCtxRef.current) return;
      const beat = currentBeatRef.current;
      playClick(audioCtxRef.current, beat === 1);
      setCurrentBeat(beat);
      currentBeatRef.current = (beat % beatsPerBarRef.current) + 1;
    }, intervalMs);
  }, [stopTicking]);

  const start = useCallback(() => {
    // Create AudioContext lazily inside user gesture handler (Safari requirement)
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    // Resume if suspended (needed on some browsers after inactivity)
    if (audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume();
    }
    currentBeatRef.current = 1;
    setCurrentBeat(1);
    setIsRunning(true);
    startTicking();
  }, [startTicking]);

  const stop = useCallback(() => {
    stopTicking();
    setIsRunning(false);
    setCurrentBeat(1);
    currentBeatRef.current = 1;
  }, [stopTicking]);

  const setBpm = useCallback((newBpm: number) => {
    const clamped = clampBpm(newBpm);
    bpmRef.current = clamped;
    setBpmState(clamped);
    if (intervalRef.current !== null) {
      // Restart ticking at new tempo
      startTicking();
    }
  }, [startTicking]);

  const setBeatsPerBar = useCallback((beats: number) => {
    const clamped = Math.max(2, Math.min(12, beats));
    beatsPerBarRef.current = clamped;
    setBeatsPerBarState(clamped);
    currentBeatRef.current = 1;
  }, []);

  const tap = useCallback(() => {
    const now = Date.now();
    const taps = tapTimesRef.current;
    taps.push(now);
    if (taps.length > 4) taps.splice(0, taps.length - 4);
    tapTimesRef.current = taps;

    if (taps.length >= 2) {
      const intervals: number[] = [];
      for (let i = 1; i < taps.length; i++) {
        intervals.push(taps[i] - taps[i - 1]);
      }
      const avgMs = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const newBpm = Math.round(60000 / avgMs);
      setBpm(newBpm);
    }
  }, [setBpm]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTicking();
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
        audioCtxRef.current = null;
      }
    };
  }, [stopTicking]);

  return [
    { isRunning, currentBeat, bpm, beatsPerBar },
    { start, stop, setBpm, setBeatsPerBar, tap },
  ];
}
