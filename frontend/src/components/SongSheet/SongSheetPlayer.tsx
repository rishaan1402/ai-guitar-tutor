"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  chordsInSheet,
  displayChord,
  keyPrefersFlats,
  mapChords,
  parseChordPro,
  type DisplayOptions,
} from "@/lib/chordpro";
import SheetView from "./SheetView";
import SheetToolbar from "./SheetToolbar";
import ChordPanel from "./ChordPanel";

interface Props {
  content: string;
  /** Hide the toolbar and panel (compact editor preview). */
  compact?: boolean;
}

const FONT_KEY = "guitar-tutor-sheet-font";

function readFont(): number {
  try {
    const v = Number(localStorage.getItem(FONT_KEY));
    return v >= 12 && v <= 26 ? v : 16;
  } catch {
    return 16;
  }
}

export default function SongSheetPlayer({ content, compact = false }: Props) {
  const sheet = useMemo(() => parseChordPro(content), [content]);
  const { meta } = sheet;

  const [options, setOptions] = useState<DisplayOptions>({
    transpose: 0,
    capo: meta.capo,
    flats: keyPrefersFlats(meta.key),
    simplify: false,
  });
  const [activeChord, setActiveChord] = useState<string | null>(null);
  const [fontSize, setFontSize] = useState(16);
  const [scrolling, setScrolling] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(3);
  const speedRef = useRef(scrollSpeed);
  speedRef.current = scrollSpeed;

  useEffect(() => setFontSize(readFont()), []);

  // A different sheet starts from its own capo and key spelling
  useEffect(() => {
    setOptions((o) => ({ ...o, capo: meta.capo, flats: keyPrefersFlats(meta.key) }));
  }, [meta.capo, meta.key]);

  const changeFont = (size: number) => {
    setFontSize(size);
    try {
      localStorage.setItem(FONT_KEY, String(size));
    } catch {
      // storage unavailable (private mode): the size just won't persist
    }
  };

  // Autoscroll: ~15 px/s at speed 1, ~150 px/s at 10
  useEffect(() => {
    if (!scrolling) return;
    let frame = 0;
    let last = performance.now();
    let carry = 0;
    const step = (now: number) => {
      carry += ((now - last) / 1000) * speedRef.current * 15;
      last = now;
      const whole = Math.floor(carry);
      if (whole > 0) {
        window.scrollBy(0, whole);
        carry -= whole;
      }
      if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 2) {
        setScrolling(false);
        return;
      }
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [scrolling]);

  // Space toggles autoscroll (outside text fields), like most chord sites
  useEffect(() => {
    if (compact) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (e.code === "Space" && !["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(tag)) {
        e.preventDefault();
        setScrolling((s) => !s);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [compact]);

  const shown = useMemo(
    () => mapChords(sheet, (c) => displayChord(c, meta, options)),
    [sheet, meta, options],
  );
  const chords = useMemo(() => chordsInSheet(shown), [shown]);
  const displayKey = meta.key ? displayChord(meta.key, meta, { ...options, capo: meta.capo, simplify: false }) : null;

  const facts = [
    displayKey && ["Key", displayKey],
    options.capo > 0 && ["Capo", `Fret ${options.capo}`],
    meta.time && ["Time", meta.time],
    meta.tempo && ["Tempo", `${meta.tempo} bpm`],
    meta.difficulty && ["Level", meta.difficulty],
    meta.tuning && ["Tuning", meta.tuning],
  ].filter(Boolean) as [string, string][];

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl sm:text-3xl font-bold text-white">{meta.title || "Untitled"}</h1>
        {meta.artist && <p className="text-gray-400 mt-0.5">{meta.artist}</p>}
        {facts.length > 0 && (
          <dl className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-sm">
            {facts.map(([k, v]) => (
              <div key={k} className="flex gap-1.5">
                <dt className="text-gray-500">{k}</dt>
                <dd className={`text-gray-200 ${k === "Level" ? "capitalize" : ""}`}>{v}</dd>
              </div>
            ))}
          </dl>
        )}
        {meta.strumming && (
          <p className="text-sm mt-2">
            <span className="text-gray-500">Strumming </span>
            <span className="font-mono text-gray-200">{meta.strumming}</span>
          </p>
        )}
      </header>

      {!compact && (
        <div className="sticky top-14 z-20 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 py-2.5 bg-[var(--bg-primary)]/90 backdrop-blur border-y border-white/5">
          <SheetToolbar
            options={options}
            onChange={setOptions}
            displayKey={displayKey}
            scrolling={scrolling}
            onToggleScroll={() => setScrolling((s) => !s)}
            scrollSpeed={scrollSpeed}
            onScrollSpeed={setScrollSpeed}
            fontSize={fontSize}
            onFontSize={changeFont}
          />
        </div>
      )}

      <div className={compact ? "" : "grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8"}>
        <SheetView
          sheet={shown}
          fontSize={compact ? 14 : fontSize}
          activeChord={activeChord}
          onChordClick={(c) => setActiveChord((cur) => (cur === c ? null : c))}
        />
        {!compact && chords.length > 0 && (
          <aside className="lg:sticky lg:top-32 lg:self-start lg:max-h-[calc(100vh-9rem)] lg:overflow-y-auto">
            <ChordPanel chords={chords} activeChord={activeChord} onSelect={setActiveChord} />
          </aside>
        )}
      </div>
    </div>
  );
}
