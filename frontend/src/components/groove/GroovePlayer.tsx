"use client";

/**
 * Play a Groove on the highway with a backing band.
 * ready -> (count-in) playing -> results. "Listen first" plays it for you.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Highway from "./Highway";
import ChordDiagram from "@/components/ChordDiagram";
import { fingeringFor } from "@/lib/chords/shape";
import { prettySymbol } from "@/lib/chordShape";
import { openMic, micErrorMessage, MIC_CONSTRAINTS } from "@/lib/mic";
import { generateGroove, saveGrooveRun, type ChordFingering } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { grooveHref, type GrooveWithSource } from "@/lib/groove/link";
import { Band } from "@/lib/groove/band";
import { ChordTracker } from "@/lib/groove/detect";
import { NoteTracker } from "@/lib/groove/pitch";
import { noteName, parseNote, STRING_NAMES } from "@/lib/groove/lead";
import { chordsIn, timeline } from "@/lib/groove/groove";
import { Transport, starsFor, summarise, type ChangeResult, type Mode } from "@/lib/groove/transport";

type Phase = "ready" | "playing" | "done";

type PlayMode = Exclude<Mode, "listen">;
const MODE_COPY: Record<PlayMode, { label: string; hint: string }> = {
  wait: { label: "Wait for me", hint: "Waits at each change until it hears your new chord." },
  follow: { label: "Follow me", hint: "Waits when you're slow, jumps ahead when you change early." },
  play: { label: "Keep time", hint: "The band keeps going; each change is scored." },
};

interface Props {
  groove: GrooveWithSource;
  /** Inside a lesson: called with the run's stars; shows "Continue" instead of the next-Groove actions. */
  onFinished?: (stars: number, results: ChangeResult[]) => void;
  finishLabel?: string;
  defaultMode?: PlayMode;
  /** Back button target when not playing (defaults to history back). */
  onBack?: () => void;
}

const FFT = 4096;

export default function GroovePlayer({ groove, onFinished, finishLabel = "Continue", defaultMode = "wait", onBack }: Props) {
  const router = useRouter();
  const { user } = useAuth();
  const [phase, setPhase] = useState<Phase>("ready");
  const [mode, setMode] = useState<PlayMode>(defaultMode);
  const [busy, setBusy] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [headphones, setHeadphones] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [heard, setHeard] = useState<string | null>(null);
  const [level, setLevel] = useState(0);
  const [judged, setJudged] = useState<Record<number, string>>({});
  const [results, setResults] = useState<ChangeResult[]>([]);
  const [shapes, setShapes] = useState<Record<string, ChordFingering | null>>({});
  const [nextChord, setNextChord] = useState<string | null>(null);

  const ctxRef = useRef<AudioContext | null>(null);
  const transportRef = useRef<Transport | null>(null);
  const micRef = useRef<{ stream: MediaStream; timer: ReturnType<typeof setInterval> } | null>(null);
  const tl = useMemo(() => timeline(groove), [groove]);
  const isLead = groove.kind === "lead";
  const bpm = Math.round(groove.bpm * speed);

  // chord shapes for the "next chord" diagram
  useEffect(() => {
    let live = true;
    if (groove.kind === "lead") return;
    Promise.all(chordsIn(groove).map(async (c) => [c, await fingeringFor(c)] as const)).then(
      (pairs) => live && setShapes(Object.fromEntries(pairs)),
    );
    return () => {
      live = false;
    };
  }, [groove]);

  const cleanup = useCallback(() => {
    transportRef.current?.stop();
    transportRef.current = null;
    if (micRef.current) {
      clearInterval(micRef.current.timer);
      micRef.current.stream.getTracks().forEach((t) => t.stop());
      micRef.current = null;
    }
  }, []);
  useEffect(() => () => {
    cleanup();
    void ctxRef.current?.close();
  }, [cleanup]);

  const audio = () => {
    if (!ctxRef.current) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctxRef.current = new AC({ latencyHint: "interactive" });
    }
    return ctxRef.current;
  };

  async function start(listen: boolean) {
    setError(null);
    cleanup();
    const ctx = audio();
    await ctx.resume();
    const band = new Band(ctx);
    const finished: ChangeResult[] = [];
    const t = new Transport(band, groove, {
      mode: listen ? "listen" : mode,
      bpm,
      full: listen || headphones,
      onResult: (r) => {
        finished.push(r);
        setJudged((j) => ({ ...j, [r.change.i]: r.status }));
      },
      onEnd: () => {
        cleanup();
        setListening(false);
        if (listen) setPhase("ready");
        else {
          const sorted = finished.slice().sort((a, b) => a.change.i - b.change.i);
          setResults(sorted);
          setPhase("done");
          const runStars = starsFor(sorted);
          if (user) {
            saveGrooveRun({
              title: groove.title,
              source: groove.source ?? "preset",
              mode: t.mode === "listen" ? "wait" : t.mode,
              bpm,
              stars: runStars,
              groove: { bars: groove.bars, focus: groove.focus ?? null, style: groove.style, strum: groove.strum },
              changes: sorted.map((r) => ({ from: r.change.from, to: r.change.to, status: r.status, offset: Math.round(r.offset * 100) / 100 })),
            }).catch(() => {});
          }
          import("@capacitor/haptics").then(({ Haptics, NotificationType }) => Haptics.notification({ type: NotificationType.Success })).catch(() => {});
        }
      },
    });
    if (!listen) {
      try {
        const stream = await openMic().catch(() => navigator.mediaDevices.getUserMedia(MIC_CONSTRAINTS));
        const src = ctx.createMediaStreamSource(stream);
        const an = ctx.createAnalyser();
        an.fftSize = FFT;
        an.smoothingTimeConstant = 0;
        src.connect(an);
        let frames = 0;
        let timer: ReturnType<typeof setInterval>;
        if (isLead) {
          // single notes: pitch + pluck onsets on the raw waveform
          an.fftSize = 2048;
          const notes = new NoteTracker(an.fftSize);
          const wave = new Float32Array(an.fftSize);
          timer = setInterval(() => {
            an.getFloatTimeDomainData(wave);
            const n = notes.feed(wave, ctx.sampleRate, ctx.currentTime);
            if (n) {
              const exp = t.expected();
              const want = exp ? parseNote(exp.to) : null;
              // a note counts for the expected string:fret if the pitch matches (any string)
              t.heard(want && want.midi === n.midi ? exp!.to : noteName(n.midi), n.time);
              setHeard(noteName(n.midi));
            }
            if (++frames % 3 === 0) setLevel(Math.max(0, Math.min(1, notes.level * 8)));
          }, 30);
        } else {
          const tracker = new ChordTracker(chordsIn(groove));
          const buf = new Float32Array(an.frequencyBinCount);
          timer = setInterval(() => {
            an.getFloatFrequencyData(buf);
            const exp = t.expected();
            const h = tracker.feed(buf, ctx.sampleRate, FFT, ctx.currentTime, exp?.to);
            if (h) {
              t.heard(h.symbol, h.time);
              setHeard(h.symbol);
            }
            if (++frames % 3 === 0) setLevel(Math.max(0, Math.min(1, (tracker.level + 90) / 50)));
          }, 30);
        }
        micRef.current = { stream, timer };
      } catch (e) {
        setError(micErrorMessage(e));
        return;
      }
    }
    setJudged({});
    setHeard(null);
    setResults([]);
    transportRef.current = t;
    setListening(listen);
    setPhase("playing");
    t.start();
  }

  const stopNow = () => {
    cleanup();
    setListening(false);
    setPhase("ready");
  };

  // the next chord to get ready for (for the diagram)
  useEffect(() => {
    if (phase !== "playing") return;
    const id = setInterval(() => {
      const t = transportRef.current;
      if (!t) return;
      const pos = t.position();
      const seg = t.segments.find((s) => s.start > pos - 0.01) ?? t.segments[t.segments.length - 1];
      setNextChord(seg?.chord ?? null);
    }, 150);
    return () => clearInterval(id);
  }, [phase]);

  async function nextGroove(focus: [string, string] | undefined, faster: boolean, kind: "next" | "fix") {
    setBusy(kind);
    try {
      const g = await generateGroove({ focus, faster, style: kind === "next" ? groove.style : undefined });
      router.push(grooveHref({ ...g, focus: g.focus ?? undefined, tip: g.tip ?? undefined, source: kind === "fix" ? "fix" : g.source, style: g.style }));
    } catch {
      setError("Couldn't build a new Groove. Check your connection.");
      setPhase("ready");
    } finally {
      setBusy(null);
    }
  }

  function askCoach() {
    const w = worst;
    const q = w
      ? `I just played "${groove.title}". My ${w.from} to ${w.to} change was ${w.onTime}/${w.total} on time${w.avgLate > 0.05 ? `, about ${w.avgLate.toFixed(1)}s late` : ""}. How do I make it faster?`
      : `I just played "${groove.title}" and got ${stars} star${stars === 1 ? "" : "s"}. What should I work on next?`;
    router.push(`/coach?q=${encodeURIComponent(q)}`);
  }

  const getPosition = useCallback(() => transportRef.current?.position() ?? -4, []);
  const isHolding = useCallback(() => transportRef.current?.isHolding() ?? false, []);
  // lead notes read as string + fret ("e1"), chords as symbols
  const label = (x: string) => {
    const n = isLead ? parseNote(x) : null;
    return n ? `${STRING_NAMES[n.string]}${n.fret}` : prettySymbol(x);
  };
  const stars = starsFor(results);
  const pairs = summarise(results);
  // the change that went worst (for "Fix it" and the coach)
  const worst = pairs.length
    ? pairs.slice().sort((a, b) => a.onTime / a.total - b.onTime / b.total || b.avgLate - a.avgLate)[0]
    : null;

  return (
    <div className="fixed inset-0 flex flex-col bg-ink-950 pb-[max(0.75rem,var(--sa-b))] pl-[max(0.75rem,var(--sa-l))] pr-[max(0.75rem,var(--sa-r))] pt-[max(0.75rem,var(--sa-t))]">
      {/* top bar */}
      <div className="flex items-center gap-3 pb-3 landscape:pb-2">
        <button onClick={() => (phase === "playing" ? stopNow() : onBack ? onBack() : router.back())} aria-label={phase === "playing" ? "Stop" : "Back"} className="flex h-10 w-10 items-center justify-center rounded-full border border-cream/15 text-cream/80">
          {phase === "playing" ? "■" : "←"}
        </button>
        <div className="min-w-0 flex-1">
          <p className="label-mono text-amber-400">Groove · {groove.style}</p>
          <h1 className="truncate font-display text-xl uppercase text-cream landscape:text-lg">{groove.title}</h1>
        </div>
        <span className="rounded-full border border-cream/10 px-3 py-1 label-mono text-cream/70">{bpm} bpm</span>
      </div>

      {/* highway + side panel */}
      <div className="relative flex min-h-0 flex-1 gap-3">
        <div className="min-w-0 flex-1">
          <Highway
            segments={tl.segments}
            changes={tl.changes}
            totalBeats={tl.totalBeats}
            strum={groove.strum}
            getPosition={getPosition}
            isHolding={isHolding}
            judged={judged}
            lead={isLead}
            beatsPerBar={groove.beatsPerBar === 3 ? 3 : 4}
          />
        </div>
        {phase === "playing" && (
          <div className="flex w-[30%] max-w-[150px] flex-col gap-3 landscape:w-[42%] landscape:max-w-[360px] landscape:flex-row landscape:items-start landscape:gap-2">
            <div className="rounded-2xl border border-cream/10 p-2 landscape:min-w-0 landscape:flex-[3]">
              <p className="label-mono text-center text-[10px] text-cream/50">Next</p>
              {isLead && nextChord && parseNote(nextChord) ? (
                <div className="py-3 text-center">
                  <p className="font-display text-4xl text-cream">{parseNote(nextChord)!.fret}</p>
                  <p className="mt-1 text-xs text-cream/60">fret · {STRING_NAMES[parseNote(nextChord)!.string]} string</p>
                  <p className="label-mono mt-1 text-[10px] text-amber-300">{noteName(parseNote(nextChord)!.midi)}</p>
                </div>
              ) : nextChord && shapes[nextChord] ? (
                <ChordDiagram fingering={shapes[nextChord]} caption={nextChord} fluid className="!bg-transparent !p-0 !shadow-none" />
              ) : (
                <p className="py-6 text-center font-display text-3xl text-cream">{nextChord ? prettySymbol(nextChord) : "–"}</p>
              )}
            </div>
            {!listening && (
              <div className="rounded-2xl border border-cream/10 p-3 text-center landscape:min-w-0 landscape:flex-[2]">
                <p className="label-mono text-[10px] text-cream/50">Heard</p>
                <p className="mt-1 font-display text-2xl text-cream">{heard ? prettySymbol(heard) : "…"}</p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-cream/10" aria-label="Mic level">
                  <div className="h-full rounded-full bg-sage-300 transition-[width] duration-100" style={{ width: `${level * 100}%` }} />
                </div>
              </div>
            )}
            {listening && <p className="label-mono text-center text-[11px] text-cream/50">Listening mode: just enjoy it</p>}
          </div>
        )}

        {/* ready card */}
        {phase === "ready" && (
          <div className="absolute inset-x-0 bottom-0 rounded-[26px] border border-cream/10 bg-ink-950/95 p-5 shadow-2xl backdrop-blur landscape:static landscape:max-h-full landscape:w-[52%] landscape:max-w-[560px] landscape:shrink-0 landscape:overflow-y-auto landscape:p-4">
            <p className="label-mono text-amber-400">{groove.focus ? `Focus: ${prettySymbol(groove.focus[0])} → ${prettySymbol(groove.focus[1])}` : "Groove"}</p>
            <p className="mt-1 text-[15px] text-cream/75 short:line-clamp-2 short:text-sm">{groove.tip ?? "Play along with the band."}</p>
            <div className="mt-4 grid grid-cols-3 gap-2 landscape:mt-3" role="radiogroup" aria-label="Mode">
              {(Object.keys(MODE_COPY) as (keyof typeof MODE_COPY)[]).map((m) => (
                <button
                  key={m}
                  role="radio"
                  aria-checked={mode === m}
                  onClick={() => setMode(m)}
                  className={`rounded-2xl border p-3 text-left landscape:p-2.5 short:py-2 ${mode === m ? "border-amber-400 bg-amber-400/10" : "border-cream/10"}`}
                >
                  <span className="block font-semibold text-cream">{MODE_COPY[m].label}</span>
                  <span className="mt-0.5 block text-xs text-cream/55 short:hidden">{MODE_COPY[m].hint}</span>
                </button>
              ))}
            </div>
            {/* short screens: the selected mode's hint, once */}
            <p className="mt-1.5 hidden text-xs text-cream/55 short:block">{MODE_COPY[mode].hint}</p>
            <div className="mt-4 flex items-center gap-3 short:mt-2">
              <label className="label-mono shrink-0 text-cream/60" htmlFor="speed">Speed</label>
              <input id="speed" type="range" min={0.6} max={1.2} step={0.05} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="flex-1 accent-amber-400" />
              <span className="w-12 text-right text-sm text-cream">{Math.round(speed * 100)}%</span>
            </div>
            <label className="mt-3 flex items-center gap-3 text-sm text-cream/75 short:mt-2">
              <input type="checkbox" checked={headphones} onChange={(e) => setHeadphones(e.target.checked)} className="h-5 w-5 accent-amber-400" />
              {isLead ? "I'm wearing headphones (hear the melody while I play)" : "I'm wearing headphones (full band with chords)"}
            </label>
            {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
            <div className="mt-4 flex gap-3 short:mt-2">
              <button onClick={() => start(true)} className="h-12 short:h-11 rounded-full border border-cream/20 px-5 text-cream">▶ Listen first</button>
              <button onClick={() => start(false)} className="h-12 flex-1 rounded-full bg-amber-400 font-semibold text-ink-950 short:h-11">Start</button>
            </div>
          </div>
        )}

        {/* results */}
        {phase === "done" && (
          <div className="absolute inset-x-0 bottom-0 max-h-full overflow-y-auto rounded-[26px] border border-cream/10 bg-ink-950/95 p-5 shadow-2xl backdrop-blur landscape:static landscape:w-[52%] landscape:max-w-[560px] landscape:shrink-0 landscape:p-4">
            <p className="label-mono text-amber-400">Run complete</p>
            <div className="mt-1 flex items-center gap-1 text-3xl" aria-label={`${stars} of 3 stars`}>
              {[0, 1, 2].map((i) => (
                <span key={i} className={i < stars ? "text-amber-400" : "text-cream/15"}>★</span>
              ))}
            </div>
            <ul className="mt-3 space-y-2">
              {pairs.map((p) => (
                <li key={`${p.from}${p.to}`} className="flex items-center justify-between rounded-xl border border-cream/10 px-3 py-2">
                  <span className="font-semibold text-cream">
                    {label(p.from)} → {label(p.to)}
                    {p.focus && <span className="label-mono ml-2 text-[10px] text-amber-300">focus</span>}
                  </span>
                  <span className="text-sm text-cream/70">
                    {p.onTime}/{p.total} on time{p.late ? ` · ${p.late} late` : ""}{p.missed ? ` · ${p.missed} missed` : ""}
                    {p.avgLate > 0.05 ? ` · avg ${p.avgLate.toFixed(1)}s` : ""}
                  </span>
                </li>
              ))}
            </ul>
            {onFinished ? (
              <div className="mt-4 flex gap-2">
                <button onClick={() => start(false)} className="h-12 rounded-full border border-cream/20 px-5 text-cream">Go again</button>
                <button onClick={() => onFinished(stars, results)} className="h-12 flex-1 rounded-full bg-amber-400 font-semibold text-ink-950">{finishLabel} →</button>
              </div>
            ) : (
              <>
                <div className="mt-4 flex gap-2">
                  <button onClick={() => start(false)} className="h-12 flex-1 rounded-full bg-amber-400 font-semibold text-ink-950">Go again</button>
                  {!isLead && <button
                    disabled={!!busy}
                    onClick={() => nextGroove(groove.focus ?? undefined, stars === 3, "next")}
                    className="h-12 flex-1 rounded-full border border-amber-400/50 px-3 text-amber-100 disabled:opacity-50"
                  >
                    {busy === "next" ? "Building…" : stars === 3 ? "Next, a bit faster" : "New Groove"}
                  </button>}
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-sm">
                  {worst && !isLead && (
                    <button disabled={!!busy} onClick={() => nextGroove([worst.from, worst.to], false, "fix")} className="h-10 rounded-full border border-cream/15 px-4 text-cream/85 disabled:opacity-50">
                      {busy === "fix" ? "Building…" : `Fix it: ${prettySymbol(worst.from)} → ${prettySymbol(worst.to)}`}
                    </button>
                  )}
                  <button onClick={() => askCoach()} className="h-10 rounded-full border border-cream/15 px-4 text-cream/85">Ask the coach</button>
                  <button onClick={() => setPhase("ready")} className="h-10 rounded-full border border-cream/15 px-4 text-cream/60">Settings</button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
