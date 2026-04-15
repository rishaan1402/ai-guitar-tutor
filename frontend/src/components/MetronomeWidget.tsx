"use client";

import React, { useState, useCallback } from "react";
import { useMetronome } from "@/lib/useMetronome";
import { bpmFromTempoFeel, beatsPerBarFromTimeSig } from "@/lib/noteDetection";

interface StrumPattern {
  name: string;
  arrows: Array<"down" | "up" | "rest">;
  description: string;
}

const STRUM_PATTERNS: StrumPattern[] = [
  {
    name: "Basic 4/4",
    arrows: ["down", "down", "down", "down"],
    description: "All downstrokes",
  },
  {
    name: "Pop 8th",
    arrows: ["down", "up", "down", "up", "down", "up", "down", "up"],
    description: "Alternating 8ths",
  },
  {
    name: "Ballad",
    arrows: ["down", "rest", "down", "up", "rest", "down", "up", "rest"],
    description: "Slow ballad feel",
  },
];

const ARROW_ICONS = { down: "↓", up: "↑", rest: "·" };

interface Props {
  tempoFeel?: string;
  timeSignature?: string;
}

export default function MetronomeWidget({ tempoFeel, timeSignature }: Props) {
  const defaultBpm = tempoFeel ? bpmFromTempoFeel(tempoFeel) : 80;
  const defaultBeats = timeSignature ? beatsPerBarFromTimeSig(timeSignature) : 4;

  const [state, controls] = useMetronome(defaultBpm, defaultBeats);
  const [expanded, setExpanded] = useState(false);
  const [patternIdx, setPatternIdx] = useState(0);
  const [tapFlash, setTapFlash] = useState(false);

  const handleTap = useCallback(() => {
    controls.tap();
    setTapFlash(true);
    setTimeout(() => setTapFlash(false), 120);
  }, [controls]);

  const pattern = STRUM_PATTERNS[patternIdx];
  // Active strum arrow: beat 1-based → 0-indexed into arrows array
  // For 8-arrow patterns and 4 beats, map: beat1→0, beat2→2, beat3→4, beat4→6
  const arrowsPerBeat = pattern.arrows.length / state.beatsPerBar;
  const activeArrowIdx = state.isRunning
    ? Math.floor((state.currentBeat - 1) * arrowsPerBeat)
    : -1;

  return (
    <div
      className="glass-card transition-all duration-300"
      style={{ minWidth: expanded ? 260 : 180 }}
    >
      {/* Compact header row — always visible */}
      <div
        className="flex items-center gap-3 p-3 cursor-pointer select-none"
        onClick={() => setExpanded((e) => !e)}
      >
        {/* Beat dots (compact) */}
        <div className="flex gap-1">
          {Array.from({ length: state.beatsPerBar }, (_, i) => {
            const isActive = state.isRunning && i + 1 === state.currentBeat;
            return (
              <div
                key={i}
                className={isActive ? "animate-metronome-beat" : ""}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: isActive
                    ? i === 0 ? "#a78bfa" : "#7c3aed"
                    : "rgba(255,255,255,0.2)",
                  transition: "background 0.1s",
                }}
              />
            );
          })}
        </div>

        {/* Play/Stop */}
        <button
          onClick={(e) => { e.stopPropagation(); state.isRunning ? controls.stop() : controls.start(); }}
          className="text-sm px-2 py-0.5 rounded-lg transition-all"
          style={{
            background: state.isRunning ? "rgba(124,58,237,0.25)" : "rgba(255,255,255,0.07)",
            border: state.isRunning ? "1px solid rgba(124,58,237,0.5)" : "1px solid rgba(255,255,255,0.15)",
            color: state.isRunning ? "#a78bfa" : "rgba(255,255,255,0.6)",
          }}
        >
          {state.isRunning ? "⏹" : "▶"}
        </button>

        {/* BPM */}
        <span className="text-xs font-mono font-semibold" style={{ color: "rgba(255,255,255,0.7)" }}>
          {state.bpm} bpm
        </span>

        {/* Chevron */}
        <span
          className="ml-auto text-xs transition-transform duration-200"
          style={{
            color: "rgba(255,255,255,0.3)",
            transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
            display: "inline-block",
          }}
        >
          ▼
        </span>
      </div>

      {/* Expanded panel */}
      {expanded && (
        <div className="px-3 pb-3 space-y-3 fade-in-up border-t border-white/5 pt-3">
          {/* BPM control */}
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => controls.setBpm(state.bpm - 5)}
              className="w-7 h-7 rounded-lg text-sm flex items-center justify-center transition-all"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.7)" }}
            >
              −
            </button>
            <span className="text-xl font-bold font-mono gradient-text w-16 text-center">
              {state.bpm}
            </span>
            <button
              onClick={() => controls.setBpm(state.bpm + 5)}
              className="w-7 h-7 rounded-lg text-sm flex items-center justify-center transition-all"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.7)" }}
            >
              +
            </button>
          </div>

          {/* Beat dots (full size) */}
          <div className="flex justify-center gap-2">
            {Array.from({ length: state.beatsPerBar }, (_, i) => {
              const isActive = state.isRunning && i + 1 === state.currentBeat;
              const isAccent = i === 0;
              return (
                <div
                  key={i}
                  className={isActive ? "animate-metronome-beat" : ""}
                  style={{
                    width: isAccent ? 14 : 12,
                    height: isAccent ? 14 : 12,
                    borderRadius: "50%",
                    background: isActive
                      ? isAccent ? "#a78bfa" : "#7c3aed"
                      : "rgba(255,255,255,0.15)",
                    border: isAccent ? "1px solid rgba(167,139,250,0.4)" : "1px solid rgba(255,255,255,0.1)",
                    transition: "background 0.05s",
                  }}
                />
              );
            })}
          </div>

          {/* Strum pattern selector */}
          <div>
            <div className="flex gap-1 mb-2">
              {STRUM_PATTERNS.map((p, i) => (
                <button
                  key={i}
                  onClick={() => setPatternIdx(i)}
                  className="flex-1 text-xs py-1 rounded-lg transition-all"
                  style={{
                    background: i === patternIdx ? "rgba(124,58,237,0.25)" : "rgba(255,255,255,0.05)",
                    border: i === patternIdx ? "1px solid rgba(124,58,237,0.5)" : "1px solid rgba(255,255,255,0.1)",
                    color: i === patternIdx ? "#a78bfa" : "rgba(255,255,255,0.5)",
                  }}
                >
                  {p.name}
                </button>
              ))}
            </div>

            {/* Strum arrows */}
            <div className="flex justify-center gap-1 flex-wrap">
              {pattern.arrows.map((arrow, i) => {
                const isActiveArrow = i === activeArrowIdx || i === activeArrowIdx + 1;
                return (
                  <span
                    key={i}
                    className="text-base font-bold transition-all duration-100"
                    style={{
                      color: isActiveArrow
                        ? arrow === "down" ? "#22d3ee" : "#a78bfa"
                        : "rgba(255,255,255,0.25)",
                      transform: isActiveArrow ? "scale(1.3)" : "scale(1)",
                      display: "inline-block",
                    }}
                  >
                    {ARROW_ICONS[arrow]}
                  </span>
                );
              })}
            </div>
            <p className="text-center text-xs mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>
              {pattern.description}
            </p>
          </div>

          {/* Tap tempo + start/stop */}
          <div className="flex gap-2">
            <button
              onClick={handleTap}
              className="flex-1 py-1.5 rounded-xl text-xs font-semibold transition-all duration-100"
              style={{
                background: tapFlash ? "rgba(124,58,237,0.35)" : "rgba(255,255,255,0.07)",
                border: tapFlash ? "1px solid rgba(124,58,237,0.6)" : "1px solid rgba(255,255,255,0.12)",
                color: tapFlash ? "#a78bfa" : "rgba(255,255,255,0.6)",
              }}
            >
              Tap ♩
            </button>
            <button
              onClick={state.isRunning ? controls.stop : controls.start}
              className="flex-1 py-1.5 rounded-xl text-xs font-semibold transition-all btn-gradient"
              style={{ color: "white" }}
            >
              {state.isRunning ? "Stop" : "Start"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
