"use client";

/**
 * The lesson step views. Each calls `onDone(stars)` when finished; reading
 * steps pass null (not scored).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import RichText from "@/components/ui/RichText";
import { FigureView, Fretboard } from "./Figures";
import { openMic, micErrorMessage } from "@/lib/mic";
import { NoteTracker } from "@/lib/groove/pitch";
import { noteName } from "@/lib/groove/lead";
import { starsFor, targetMatches, pcName, type Question, type Step, type Target, type Dot } from "@/lib/path/steps";
import { makeRound, type EarRound } from "@/lib/path/ear";
import { planRhythm, scoreTaps, type RhythmScore } from "@/lib/path/rhythm";
import { lessonBand, playNotes } from "@/lib/path/synth";

type Done = (stars: number | null) => void;

const primary = "h-12 rounded-full bg-amber-400 px-6 font-semibold text-ink-950 disabled:opacity-40";
const secondary = "h-11 rounded-full border border-cream/15 px-5 text-cream/80";

function Stars({ n }: { n: number }) {
  return (
    <span className="text-2xl" aria-label={`${n} of 3 stars`}>
      {[0, 1, 2].map((k) => (
        <span key={k} className={k < n ? "text-amber-400" : "text-cream/15"}>★</span>
      ))}
    </span>
  );
}

/* ------------------------------------------------------------------ read */

export function ReadStep({ step, onDone }: { step: Extract<Step, { kind: "read" }>; onDone: Done }) {
  const figs = step.figures ?? [];
  const pictures = figs.filter((f) => f.kind !== "sound");
  const sounds = figs.filter((f) => f.kind === "sound");
  return (
    <div className="space-y-4">
      <p className="label-mono text-amber-400">{step.title}</p>
      <div className={pictures.length ? "grid gap-5 landscape:grid-cols-[1.1fr_1fr] landscape:items-start" : ""}>
        <RichText text={step.body} className="text-[15px] leading-relaxed text-cream/85" />
        {pictures.length > 0 && (
          <div className="flex flex-wrap items-start gap-3">
            {pictures.map((f, k) => (
              <div key={k} className={f.kind === "chord" ? "" : "w-full"}>
                <FigureView figure={f} />
              </div>
            ))}
          </div>
        )}
      </div>
      {sounds.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {sounds.map((f, k) => <FigureView key={k} figure={f} />)}
        </div>
      )}
      <button onClick={() => onDone(null)} className={`${primary} sticky bottom-3 z-10 w-full shadow-lg shadow-black/40`}>Got it →</button>
    </div>
  );
}

/* ------------------------------------------------------------------ quiz */

export function QuizStep({ step, onDone }: { step: Extract<Step, { kind: "quiz" }>; onDone: Done }) {
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [right, setRight] = useState(0);
  const [finished, setFinished] = useState(false);
  const qn: Question = step.questions[i];
  const total = step.questions.length;

  if (finished) {
    const stars = starsFor(right / total);
    return (
      <div className="rounded-[22px] border border-cream/10 p-5 text-center">
        <p className="label-mono text-amber-400">{step.title}</p>
        <p className="mt-2 font-display text-3xl text-cream">{right}/{total}</p>
        <Stars n={stars} />
        <div className="mt-4 flex justify-center gap-2">
          <button onClick={() => { setI(0); setRight(0); setPicked(null); setFinished(false); }} className={secondary}>Try again</button>
          <button onClick={() => onDone(stars)} className={primary}>Continue →</button>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="label-mono text-amber-400">{step.title}</p>
        <p className="label-mono text-cream/45">{i + 1} / {total}</p>
      </div>
      <p className="text-lg font-semibold text-cream">{qn.q}</p>
      <div className="grid gap-2 landscape:grid-cols-2" role="radiogroup">
        {qn.options.map((o, k) => {
          const show = picked !== null;
          const good = k === qn.answer;
          return (
            <button
              key={k}
              role="radio"
              aria-checked={picked === k}
              disabled={show}
              onClick={() => {
                setPicked(k);
                if (k === qn.answer) setRight((r) => r + 1);
              }}
              className={`rounded-2xl border p-3 text-left text-[15px] ${
                show && good ? "border-sage-300 bg-sage-300/15 text-sage-100" : show && picked === k ? "border-amp-400 bg-amp-500/10 text-cream" : "border-cream/12 text-cream/85"
              }`}
            >
              {o}
            </button>
          );
        })}
      </div>
      {picked !== null && (
        <div className="rounded-2xl bg-cream/[0.04] p-3" aria-live="polite">
          <p className={`font-semibold ${picked === qn.answer ? "text-sage-200" : "text-amber-300"}`}>{picked === qn.answer ? "Right." : "Not quite."}</p>
          <p className="mt-1 text-sm text-cream/75">{qn.why}</p>
          <button
            onClick={() => {
              if (i + 1 >= total) setFinished(true);
              else {
                setI(i + 1);
                setPicked(null);
              }
            }}
            className={`${primary} mt-3 w-full`}
          >
            {i + 1 >= total ? "See score" : "Next question →"}
          </button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ play the notes (pitch) */

function useNoteListener(onNote: (midi: number) => void) {
  const [state, setState] = useState<"idle" | "listening">("idle");
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState(0);
  const stop = useRef<() => void>(() => {});
  const cb = useRef(onNote);
  cb.current = onNote;
  useEffect(() => () => stop.current(), []);
  async function start() {
    setError(null);
    try {
      const stream = await openMic();
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AC();
      const an = ctx.createAnalyser();
      an.fftSize = 2048;
      ctx.createMediaStreamSource(stream).connect(an);
      const tracker = new NoteTracker(an.fftSize);
      const buf = new Float32Array(an.fftSize);
      const timer = setInterval(() => {
        an.getFloatTimeDomainData(buf);
        const h = tracker.feed(buf, ctx.sampleRate, ctx.currentTime);
        setLevel(Math.min(1, tracker.level * 8));
        if (h) cb.current(h.midi);
      }, 25);
      stop.current = () => {
        clearInterval(timer);
        stream.getTracks().forEach((t) => t.stop());
        void ctx.close();
        setState("idle");
      };
      setState("listening");
    } catch (e) {
      setError(micErrorMessage(e));
    }
  }
  return { state, error, level, start, stop: () => stop.current() };
}

function dotFor(t: Target): Dot | null {
  const m = /^(high e|B|G|D|A|low E) string, fret (\d+)/.exec(t.label);
  if (!m) return null;
  const s = { "high e": 1, B: 2, G: 3, D: 4, A: 5, "low E": 6 }[m[1]]!;
  return { string: s, fret: Number(m[2]) };
}

export function PlayStep({ step, onDone }: { step: Extract<Step, { kind: "play" }>; onDone: Done }) {
  const [i, setI] = useState(0);
  const [misses, setMisses] = useState(0);
  const [heard, setHeard] = useState<number | null>(null);
  const done = i >= step.targets.length;
  const target = step.targets[Math.min(i, step.targets.length - 1)];
  const lastMiss = useRef(0);
  const at = useRef(0);
  const mic = useNoteListener((midi) => {
    setHeard(midi);
    const k = at.current;
    if (k >= step.targets.length) return;
    if (targetMatches(step.targets[k], midi)) {
      at.current = k + 1;
      setI(k + 1);
      if (k + 1 >= step.targets.length) {
        mic.stop();
        import("@capacitor/haptics").then(({ Haptics, NotificationType }) => Haptics.notification({ type: NotificationType.Success })).catch(() => {});
      }
      return;
    }
    // a wrong note (debounced: one miss per half second)
    const now = performance.now();
    if (now - lastMiss.current > 500) {
      lastMiss.current = now;
      setMisses((m) => m + 1);
    }
  });
  const shown = useMemo(() => step.targets.map(dotFor), [step.targets]);
  const allDots = shown.every(Boolean);
  const stars = misses <= 1 ? 3 : misses <= 4 ? 2 : 1;

  return (
    <div className="space-y-3">
      <p className="label-mono text-amber-400">{step.title}</p>
      <RichText text={step.prompt} className="text-[15px] text-cream/85" />
      <div className="grid gap-3 landscape:grid-cols-[1.4fr_1fr] landscape:items-start">
        <div>
          {step.figure ? (
            <FigureView figure={step.figure} />
          ) : allDots ? (
            <Fretboard dots={shown.map((d, k) => ({ ...d!, label: String(k + 1), role: k < i ? "ghost" : "note" }))} active={done ? undefined : i} />
          ) : null}
        </div>
        <div className="rounded-[22px] border border-cream/10 p-4 text-center" aria-live="polite">
          {done ? (
            <>
              <p className="label-mono text-sage-200">All played</p>
              <Stars n={stars} />
              <p className="mt-1 text-sm text-cream/60">{misses ? `${misses} wrong note${misses > 1 ? "s" : ""} on the way` : "Clean."}</p>
              <button onClick={() => onDone(stars)} className={`${primary} mt-3 w-full`}>Continue →</button>
            </>
          ) : (
            <>
              <p className="label-mono text-[10px] text-cream/50">Note {i + 1} of {step.targets.length}</p>
              <p className="mt-1 font-display text-2xl text-cream">{target.midi !== undefined ? noteName(target.midi).replace(/\d+$/, "") : pcName(target.pc!)}</p>
              <p className="text-sm text-cream/65">{target.label}</p>
              {mic.state === "listening" && (
                <>
                  <p className="mt-2 text-sm text-cream/55">Heard: <span className="font-semibold text-cream">{heard !== null ? noteName(heard) : "…"}</span></p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-cream/10"><div className="h-full bg-sage-300" style={{ width: `${mic.level * 100}%` }} /></div>
                </>
              )}
              <div className="mt-3 flex flex-col gap-2">
                {mic.state === "idle" && <button onClick={mic.start} className={primary}>Start listening</button>}
                {target.midi !== undefined && <button onClick={() => playNotes([target.midi!])} className={secondary}>▶ Hear it</button>}
              </div>
              {mic.error && <p role="alert" className="mt-2 text-sm text-red-300">{mic.error}</p>}
            </>
          )}
        </div>
      </div>
      {!done && (
        <button onClick={() => { mic.stop(); onDone(null); }} className="w-full text-center text-sm text-cream/45 underline-offset-4 hover:underline">
          Skip for now (no mic, or a noisy room)
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ ear training */

export function EarStep({ step, onDone }: { step: Extract<Step, { kind: "ear" }>; onDone: Done }) {
  const [round, setRound] = useState<EarRound>(() => makeRound(step.mode, step.options));
  const [n, setN] = useState(0);
  const [right, setRight] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const finished = n >= step.rounds;
  const playIt = (r = round) => playNotes(r.notes, 0.7, r.together);
  const prompt = step.mode === "interval" ? "Which interval?" : step.mode === "quality" ? "Which kind of chord?" : "Which note is higher?";

  if (finished) {
    const stars = starsFor(right / step.rounds);
    return (
      <div className="rounded-[22px] border border-cream/10 p-5 text-center">
        <p className="label-mono text-amber-400">{step.title}</p>
        <p className="mt-2 font-display text-3xl text-cream">{right}/{step.rounds}</p>
        <Stars n={stars} />
        <div className="mt-4 flex justify-center gap-2">
          <button onClick={() => { setN(0); setRight(0); setPicked(null); setRound(makeRound(step.mode, step.options)); }} className={secondary}>Again</button>
          <button onClick={() => onDone(stars)} className={primary}>Continue →</button>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="label-mono text-amber-400">{step.title}</p>
        <p className="label-mono text-cream/45">{n + 1} / {step.rounds}</p>
      </div>
      <div className="flex items-center gap-3">
        <button onClick={() => playIt()} className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-400 text-xl text-ink-950" aria-label="Play it">▶</button>
        <p className="text-lg font-semibold text-cream">{prompt}</p>
      </div>
      <div className="grid grid-cols-2 gap-2 landscape:grid-cols-3">
        {(step.mode === "higher" ? ["first", "second"] : step.options).map((o) => {
          const show = picked !== null;
          return (
            <button
              key={o}
              disabled={show}
              onClick={() => {
                setPicked(o);
                if (o === round.answer) setRight((r) => r + 1);
              }}
              className={`rounded-2xl border p-3 text-[15px] capitalize ${
                show && o === round.answer ? "border-sage-300 bg-sage-300/15 text-sage-100" : show && o === picked ? "border-amp-400 text-cream" : "border-cream/12 text-cream/85"
              }`}
            >
              {o}
            </button>
          );
        })}
      </div>
      {picked !== null && (
        <div className="flex gap-2">
          <button onClick={() => playIt()} className={secondary}>▶ Hear it again</button>
          <button
            onClick={() => {
              const r = makeRound(step.mode, step.options);
              setRound(r);
              setPicked(null);
              setN(n + 1);
              if (n + 1 < step.rounds) setTimeout(() => playIt(r), 250);
            }}
            className={`${primary} flex-1`}
          >
            {n + 1 >= step.rounds ? "See score" : "Next →"}
          </button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ rhythm (tap along) */

export function RhythmStep({ step, onDone }: { step: Extract<Step, { kind: "rhythm" }>; onDone: Done }) {
  const plan = useMemo(() => planRhythm(step.pattern, step.bpm, step.bars), [step.pattern, step.bpm, step.bars]);
  const [phase, setPhase] = useState<"ready" | "listen" | "count" | "tap" | "done">("ready");
  const [score, setScore] = useState<RhythmScore | null>(null);
  const [cursor, setCursor] = useState(-1);
  const t0 = useRef(0);
  const taps = useRef<number[]>([]);
  const raf = useRef(0);
  const beat = 60 / step.bpm;
  const slots = step.pattern.replace(/\s+/g, "");
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  function run(listen: boolean) {
    const b = lessonBand();
    if (!b) return;
    const now = b.ctx.currentTime + 0.1;
    const countIn = listen ? 0 : beat * 4;
    t0.current = now + countIn;
    taps.current = [];
    // count-in clicks, then a click every beat; the pattern itself is heard when listening
    if (!listen) for (let k = 0; k < 4; k++) b.click(now + k * beat, k === 0);
    for (let k = 0; k < step.bars * 4; k++) b.click(t0.current + k * beat, k % 4 === 0);
    if (listen) plan.hits.forEach((h) => b.note(t0.current + h, 57));
    setPhase(listen ? "listen" : "count");
    const loop = () => {
      const t = b.ctx.currentTime - t0.current;
      if (!listen && t >= 0) setPhase((p) => (p === "count" ? "tap" : p));
      setCursor(t < 0 ? -1 : Math.floor(t / plan.slotSec) % plan.slotsPerBar);
      if (t > plan.length + 0.3) {
        setCursor(-1);
        if (listen) setPhase("ready");
        else {
          setScore(scoreTaps(plan.hits, taps.current));
          setPhase("done");
        }
        return;
      }
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
  }

  function tap() {
    const b = lessonBand();
    if (!b || (phase !== "tap" && phase !== "count")) return;
    taps.current.push(b.ctx.currentTime - t0.current);
  }

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        tap();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });

  const stars = score ? starsFor(score.share) : 0;
  const late = score ? score.errors.filter((e): e is number => e !== null) : [];
  const avg = late.length ? Math.round(late.reduce((a, b) => a + b, 0) / late.length) : 0;

  return (
    <div className="space-y-3">
      <p className="label-mono text-amber-400">{step.title}</p>
      <RichText text={step.prompt} className="text-[15px] text-cream/85" />
      {/* the pattern, one box per slot; the beat numbers on top */}
      <div className="flex gap-1" aria-label={`Pattern ${slots}`}>
        {slots.split("").map((c, k) => {
          const onBeat = k % (slots.length / 4) === 0;
          return (
            <div key={k} className="flex flex-1 flex-col items-center gap-1">
              <span className="label-mono h-3 text-[10px] text-cream/40">{onBeat ? k / (slots.length / 4) + 1 : ""}</span>
              <span
                className={`flex h-10 w-full items-center justify-center rounded-lg border text-lg ${
                  cursor === k ? "border-amber-300 bg-amber-400/30" : c === "x" ? "border-cream/25 bg-cream/10" : "border-cream/8"
                }`}
              >
                {c === "x" ? "●" : ""}
              </span>
            </div>
          );
        })}
      </div>
      {phase === "done" && score ? (
        <div className="rounded-[22px] border border-cream/10 p-4 text-center" aria-live="polite">
          <Stars n={stars} />
          <p className="mt-1 text-cream/75">
            {score.errors.filter((e) => e !== null).length}/{plan.hits.length} hits
            {score.extra ? ` · ${score.extra} extra` : ""}
            {late.length ? ` · ${Math.abs(avg) < 15 ? "right on time" : avg > 0 ? `${avg} ms late on average` : `${-avg} ms early on average`}` : ""}
          </p>
          <div className="mt-3 flex justify-center gap-2">
            <button onClick={() => run(false)} className={secondary}>Again</button>
            <button onClick={() => onDone(stars)} className={primary}>Continue →</button>
          </div>
        </div>
      ) : (
        <div className="grid gap-2 landscape:grid-cols-[1fr_2fr]">
          <div className="flex gap-2 landscape:flex-col">
            <button disabled={phase !== "ready"} onClick={() => run(true)} className={`${secondary} flex-1`}>▶ Listen first</button>
            <button disabled={phase !== "ready"} onClick={() => run(false)} className={`${primary} flex-1`}>Start ({step.bpm} bpm)</button>
          </div>
          <button
            onPointerDown={(e) => {
              e.preventDefault();
              tap();
            }}
            className={`h-28 rounded-[22px] border-2 font-display text-xl uppercase ${phase === "tap" ? "border-amber-400 bg-amber-400/15 text-amber-100" : phase === "count" ? "border-cream/30 text-cream/70" : "border-cream/10 text-cream/30"}`}
          >
            {phase === "count" ? "Get ready… 1 2 3 4" : phase === "tap" ? "Tap the dots" : phase === "listen" ? "Listen…" : "Tap here (or space)"}
          </button>
        </div>
      )}
    </div>
  );
}
