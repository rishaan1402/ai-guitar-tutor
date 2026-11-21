"use client";

/**
 * Newer lesson exercises: play it back, the speed ladder, improvise over a
 * band, and the fretboard game. Each calls `onDone(stars)` (null if skipped).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import RichText from "@/components/ui/RichText";
import GroovePlayer from "@/components/groove/GroovePlayer";
import { FigureView, Fretboard } from "./Figures";
import { useNoteListener } from "./Steps";
import { noteName } from "@/lib/groove/lead";
import { chordNotes } from "@/lib/groove/theory";
import { prettySymbol } from "@/lib/chordShape";
import { lessonBand, playNotes } from "@/lib/path/synth";
import { starsFor, type Step } from "@/lib/path/steps";
import {
  PhraseMatcher, echoStars, startLadder, climb, ladderDone, ladderStars, scoreSolo, fretQuestion, sameNote, NOTE_CHOICES,
  type Ladder, type SoloNote, type SoloScore, type FretQuestion,
} from "@/lib/path/exercises";

type Done = (stars: number | null) => void;
const primary = "h-12 rounded-full bg-amber-400 px-6 font-semibold text-ink-950 disabled:opacity-40";
const secondary = "h-11 rounded-full border border-cream/15 px-5 text-cream/80 disabled:opacity-40";

function Stars({ n }: { n: number }) {
  return (
    <span className="text-2xl" aria-label={`${n} of 3 stars`}>
      {[0, 1, 2].map((k) => (
        <span key={k} className={k < n ? "text-amber-400" : "text-cream/15"}>★</span>
      ))}
    </span>
  );
}

/* ------------------------------------------------------------------ play it back */

export function EchoStep({ step, onDone }: { step: Extract<Step, { kind: "echo" }>; onDone: Done }) {
  const [p, setP] = useState(0);
  const [got, setGot] = useState(0);
  const [misses, setMisses] = useState(0);
  const [heard, setHeard] = useState<number | null>(null);
  const [reveal, setReveal] = useState(!!step.showNotes);
  const matcher = useRef(new PhraseMatcher(step.phrases[0]));
  const lastMiss = useRef(0);
  const total = step.phrases.reduce((n, ph) => n + ph.length, 0);
  const finished = p >= step.phrases.length;
  const phrase = step.phrases[Math.min(p, step.phrases.length - 1)];

  const listen = (k = p) => {
    const ph = step.phrases[k];
    if (ph) playNotes(ph.map((t) => t.midi!), 0.42);
  };

  const mic = useNoteListener((midi) => {
    setHeard(midi);
    const r = matcher.current.feed(midi);
    if (r === "miss") {
      const now = performance.now();
      if (now - lastMiss.current > 450) {
        lastMiss.current = now;
        setMisses((m) => m + 1);
      }
      return;
    }
    setGot(matcher.current.i);
    if (r === "done") {
      const next = p + 1;
      setTimeout(() => {
        setP(next);
        setGot(0);
        if (next < step.phrases.length) {
          matcher.current = new PhraseMatcher(step.phrases[next]);
          setTimeout(() => listen(next), 500);
        } else mic.stop();
      }, 400);
    }
  });

  useEffect(() => () => mic.stop(), []); // eslint-disable-line react-hooks/exhaustive-deps

  if (finished) {
    const stars = echoStars(total, misses);
    return (
      <div className="rounded-[22px] border border-cream/10 p-5 text-center">
        <p className="label-mono text-amber-400">{step.title}</p>
        <p className="mt-2 text-cream/75">{step.phrases.length} phrases played back{misses ? ` · ${misses} wrong note${misses > 1 ? "s" : ""} on the way` : " · clean"}</p>
        <Stars n={stars} />
        <button onClick={() => onDone(stars)} className={`${primary} mt-4`}>Continue →</button>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="label-mono text-amber-400">{step.title}</p>
        <p className="label-mono text-cream/45">Phrase {p + 1} / {step.phrases.length}</p>
      </div>
      <RichText text={step.prompt} className="text-[15px] text-cream/85" />
      <div className="grid gap-3 landscape:grid-cols-[1.3fr_1fr] landscape:items-start">
        <div className="space-y-3 rounded-[22px] border border-cream/10 p-4">
          <div className="flex items-center gap-2" aria-label={`${got} of ${phrase.length} notes`}>
            {phrase.map((_, k) => (
              <span key={k} className={`h-3 flex-1 rounded-full ${k < got ? "bg-sage-300" : "bg-cream/10"}`} />
            ))}
          </div>
          {reveal ? (
            <Fretboard dots={phrase.map((t, k) => ({ ...dotOf(t.label), label: String(k + 1), role: k < got ? "ghost" : "note" }))} />
          ) : (
            <button onClick={() => setReveal(true)} className="text-sm text-cream/50 underline-offset-4 hover:underline">Stuck? Show me the notes</button>
          )}
        </div>
        <div className="flex flex-col gap-2 rounded-[22px] border border-cream/10 p-4 text-center">
          <button onClick={() => listen()} className={primary}>▶ Hear the phrase</button>
          {mic.state === "idle" ? (
            <button onClick={() => { mic.start(); listen(); }} className={secondary}>🎤 Start listening</button>
          ) : (
            <p className="text-sm text-cream/60">Play it back… heard <span className="font-semibold text-cream">{heard !== null ? noteName(heard) : "…"}</span></p>
          )}
          {mic.error && <p role="alert" className="text-sm text-red-300">{mic.error}</p>}
        </div>
      </div>
      <button onClick={() => { mic.stop(); onDone(null); }} className="w-full text-center text-sm text-cream/45 underline-offset-4 hover:underline">
        Skip for now (no mic, or a noisy room)
      </button>
    </div>
  );
}

function dotOf(label: string): { string: number; fret: number } {
  const m = /^(high e|B|G|D|A|low E) string, fret (\d+)/.exec(label);
  const s = { "high e": 1, B: 2, G: 3, D: 4, A: 5, "low E": 6 }[m?.[1] ?? "G"] ?? 3;
  return { string: s, fret: Number(m?.[2] ?? 0) };
}

/* ------------------------------------------------------------------ speed ladder */

const ladderKey = (id: string) => `os:ladder:${id}`;

export function LadderStep({ step, onDone }: { step: Extract<Step, { kind: "ladder" }>; onDone: Done }) {
  const [ladder, setLadder] = useState<Ladder>(() => {
    let best = 0;
    try {
      best = Number(localStorage.getItem(ladderKey(step.groove.id))) || 0;
    } catch {
      /* storage blocked */
    }
    // pick up where you left off, a rung below your best
    const start = Math.max(step.start, Math.min(step.target, best ? best - (step.step ?? 4) : step.start));
    return { ...startLadder(start, step.target, step.step ?? 4, best), start: step.start };
  });
  const [running, setRunning] = useState(false);
  const [last, setLast] = useState<{ stars: number; bpm: number } | null>(null);

  if (running) {
    return (
      <GroovePlayer
        key={`${step.groove.id}-${ladder.bpm}`}
        groove={{ ...step.groove, bpm: ladder.bpm, source: "path" }}
        defaultMode="play"
        finishLabel="Back to the ladder"
        onFinished={(stars) => {
          const next = climb(ladder, stars);
          setLast({ stars, bpm: ladder.bpm });
          setLadder(next);
          try {
            if (next.best) localStorage.setItem(ladderKey(step.groove.id), String(next.best));
          } catch {
            /* storage blocked */
          }
          setRunning(false);
        }}
        onBack={() => setRunning(false)}
      />
    );
  }

  const rungs: number[] = [];
  for (let b = step.start; b <= step.target; b += step.step ?? 4) rungs.push(b);
  if (rungs[rungs.length - 1] !== step.target) rungs.push(step.target);
  return (
    <div className="space-y-3">
      <p className="label-mono text-amber-400">{step.title}</p>
      <RichText text={step.prompt} className="text-[15px] text-cream/85" />
      <div className="grid gap-3 landscape:grid-cols-[1fr_1.2fr] landscape:items-center">
        <ol className="flex flex-wrap items-end gap-1.5 rounded-[22px] border border-cream/10 p-3" aria-label="The ladder, slow to fast">
          {rungs.map((b, k) => {
            const here = b === ladder.bpm && !ladderDone(ladder);
            const done = b <= ladder.best;
            return (
              <li key={b} className="flex flex-1 flex-col items-center gap-1" aria-current={here ? "step" : undefined}>
                <span
                  className={`w-full rounded-md ${done ? "bg-sage-300/70" : here ? "bg-amber-400" : "bg-cream/10"}`}
                  style={{ height: 14 + (k / Math.max(1, rungs.length - 1)) * 46 }}
                />
                <span className={`font-mono text-[10px] ${here ? "text-amber-200" : done ? "text-sage-200" : "text-cream/40"}`}>{b}</span>
              </li>
            );
          })}
        </ol>
        <div className="space-y-3 text-center landscape:text-left">
          {last && (
            <p className={last.stars >= 2 ? "text-sage-200" : "text-amber-200"} aria-live="polite">
              {last.stars >= 2 ? `Clean at ${last.bpm} bpm. Up a rung.` : `${last.bpm} bpm isn't clean yet. Same speed again: slow is how fast happens.`}
            </p>
          )}
          {ladderDone(ladder) ? <p className="text-cream">You reached {step.target} bpm.</p> : <p className="text-cream/70">Play it clean (2 stars or more) to climb.</p>}
          <div className="flex flex-wrap justify-center gap-2 landscape:justify-start">
            {!ladderDone(ladder) && <button onClick={() => setRunning(true)} className={primary}>Play at {ladder.bpm} bpm</button>}
            <button onClick={() => onDone(ladderStars(ladder))} className={ladderDone(ladder) ? primary : secondary}>
              {ladderDone(ladder) ? "Continue →" : "Finish for today"}
            </button>
          </div>
          {ladder.best > 0 && <p className="label-mono text-[10px] text-cream/45">Your best: {ladder.best} bpm</p>}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ improvise */

export function ImproviseStep({ step, onDone }: { step: Extract<Step, { kind: "improvise" }>; onDone: Done }) {
  const [phase, setPhase] = useState<"ready" | "jam" | "done">("ready");
  const [headphones, setHeadphones] = useState(false);
  const [chordNow, setChordNow] = useState<string | null>(null);
  const [score, setScore] = useState<SoloScore | null>(null);
  const [count, setCount] = useState(0);
  const notes = useRef<SoloNote[]>([]);
  const raf = useRef(0);
  const mic = useNoteListener((midi) => {
    if (phase !== "jam") return;
    notes.current.push({ midi, time: performance.now() / 1000 });
    setCount(notes.current.length);
  });
  const eighth = 60 / step.bpm / 2;
  const totalBars = step.bars.length * step.loops;

  useEffect(() => () => {
    cancelAnimationFrame(raf.current);
    mic.stop();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function start() {
    const b = lessonBand();
    if (!b) return;
    b.style = step.style;
    notes.current = [];
    setCount(0);
    void mic.start();
    const t0 = b.ctx.currentTime + 0.3;
    for (let e = 0; e < totalBars * 8; e++) {
      const chord = step.bars[Math.floor(e / 8) % step.bars.length][0];
      b.playEighth(t0 + e * eighth, e % 8, headphones ? chord : null, eighth, {
        full: headphones,
        strum: e % 8 === 0 || e % 8 === 4 ? "D" : ".",
        padSeconds: e % 8 === 0 ? eighth * 8 : undefined,
      });
    }
    const end = t0 + totalBars * 8 * eighth;
    setPhase("jam");
    const loop = () => {
      const t = b.ctx.currentTime;
      const bar = Math.floor((t - t0) / (eighth * 8));
      setChordNow(bar >= 0 ? step.bars[bar % step.bars.length][0] : null);
      if (t >= end + 0.3) {
        mic.stop();
        setScore(scoreSolo(notes.current, step.scalePcs, step.homePc));
        setPhase("done");
        return;
      }
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
  }

  const homeName = NOTE_CHOICES[step.homePc];
  const chordTones = chordNow ? chordNotes(chordNow)?.pcs.map((p) => NOTE_CHOICES[p]).join(" ") : null;

  if (phase === "done" && score) {
    return (
      <div className="rounded-[22px] border border-cream/10 p-5 text-center">
        <p className="label-mono text-amber-400">{step.title}</p>
        <Stars n={score.stars} />
        <ul className="mx-auto mt-3 max-w-sm space-y-1 text-left text-[15px] text-cream/80">
          <li>{score.notes} notes · {Math.round(score.inScale * 100)}% in the scale</li>
          <li>{score.phrases} phrase{score.phrases === 1 ? "" : "s"} {score.phrases < 3 ? "(leave more space between ideas)" : "with space between them"}</li>
          <li>{score.endsHome ? `Ended on ${homeName}: it sounds finished` : `Try ending on ${homeName}: it sounds like home`}</li>
        </ul>
        <div className="mt-4 flex justify-center gap-2">
          <button onClick={() => { setScore(null); setPhase("ready"); }} className={secondary}>Jam again</button>
          <button onClick={() => onDone(score.stars)} className={primary}>Continue →</button>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <p className="label-mono text-amber-400">{step.title}</p>
      <RichText text={step.prompt} className="text-[15px] text-cream/85" />
      <div className="grid gap-3 landscape:grid-cols-[1.4fr_1fr] landscape:items-start">
        <div>{step.figure && <FigureView figure={step.figure} />}</div>
        <div className="space-y-3 rounded-[22px] border border-cream/10 p-4 text-center">
          {phase === "jam" ? (
            <>
              <p className="label-mono text-[10px] text-cream/50">Now</p>
              <p className="font-display text-4xl text-cream">{chordNow ? prettySymbol(chordNow) : "…"}</p>
              {chordTones && <p className="text-xs text-cream/50">chord tones {chordTones}</p>}
              <p className="text-sm text-cream/60">{count} notes heard</p>
            </>
          ) : (
            <>
              <p className="text-sm text-cream/70">{totalBars} bars at {step.bpm} bpm: {step.bars.map((b) => b[0]).join(" · ")}</p>
              <label className="flex items-center justify-center gap-2 text-sm text-cream/75">
                <input type="checkbox" checked={headphones} onChange={(e) => setHeadphones(e.target.checked)} className="h-5 w-5 accent-amber-400" />
                I&apos;m wearing headphones (full band)
              </label>
              <button onClick={start} className={primary}>Start the jam</button>
            </>
          )}
          {mic.error && <p role="alert" className="text-sm text-red-300">{mic.error}</p>}
        </div>
      </div>
      {phase === "ready" && (
        <button onClick={() => onDone(null)} className="w-full text-center text-sm text-cream/45 underline-offset-4 hover:underline">Skip for now</button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ fretboard game */

export function FretGameStep({ step, onDone }: { step: Extract<Step, { kind: "fretgame" }>; onDone: Done }) {
  const [q, setQ] = useState<FretQuestion>(() => fretQuestion(step.strings, step.frets, null));
  const [n, setN] = useState(0);
  const [right, setRight] = useState(0);
  const [flash, setFlash] = useState<"right" | "wrong" | null>(null);
  const [times, setTimes] = useState<number[]>([]);
  const shownAt = useRef(performance.now());
  const finished = n >= step.rounds;
  const avg = useMemo(() => (times.length ? times.reduce((a, b) => a + b, 0) / times.length : 0), [times]);

  function answer(name: string) {
    if (flash) return;
    const ok = sameNote(name, q.answer);
    setFlash(ok ? "right" : "wrong");
    if (ok) setRight((r) => r + 1);
    setTimes((t) => [...t, (performance.now() - shownAt.current) / 1000]);
    playNotes([({ 6: 40, 5: 45, 4: 50, 3: 55, 2: 59, 1: 64 } as Record<number, number>)[q.string] + q.fret]);
    setTimeout(() => {
      setFlash(null);
      setN((k) => k + 1);
      setQ((last) => fretQuestion(step.strings, step.frets, last));
      shownAt.current = performance.now();
    }, ok ? 450 : 1100);
  }

  if (finished) {
    const stars = starsFor(right / step.rounds) - (avg > 6 ? 1 : 0);
    return (
      <div className="rounded-[22px] border border-cream/10 p-5 text-center">
        <p className="label-mono text-amber-400">{step.title}</p>
        <p className="mt-2 font-display text-3xl text-cream">{right}/{step.rounds}</p>
        <p className="text-sm text-cream/60">{avg.toFixed(1)} s per note{avg > 6 ? " (aim for under 6)" : ""}</p>
        <Stars n={Math.max(0, stars)} />
        <div className="mt-4 flex justify-center gap-2">
          <button onClick={() => { setN(0); setRight(0); setTimes([]); shownAt.current = performance.now(); }} className={secondary}>Again</button>
          <button onClick={() => onDone(Math.max(0, stars))} className={primary}>Continue →</button>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="label-mono text-amber-400">{step.title}</p>
        <p className="label-mono text-cream/45">{n + 1} / {step.rounds} · {right} right</p>
      </div>
      <RichText text={step.prompt} className="text-[15px] text-cream/85" />
      <div className={`rounded-[22px] transition-shadow ${flash === "right" ? "shadow-[0_0_0_2px_rgb(var(--ok-300))]" : flash === "wrong" ? "shadow-[0_0_0_2px_rgb(var(--live-400))]" : ""}`}>
        <Fretboard dots={[{ string: q.string, fret: q.fret, role: "root", label: flash ? q.answer : "?" }]} from={step.frets[0] === 0 ? 0 : step.frets[0] - 1} to={step.frets[1]} />
      </div>
      <div className="grid grid-cols-6 gap-1.5 landscape:grid-cols-12" role="group" aria-label="Note names">
        {NOTE_CHOICES.map((c) => (
          <button key={c} onClick={() => answer(c)} className="h-11 rounded-xl border border-cream/12 text-[15px] font-semibold text-cream hover:bg-cream/5">
            {c.includes("#") ? `${c}/${({ "C#": "Db", "D#": "Eb", "F#": "Gb", "G#": "Ab", "A#": "Bb" } as Record<string, string>)[c]}` : c}
          </button>
        ))}
      </div>
    </div>
  );
}
