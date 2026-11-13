"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import ScoreRing from "@/components/ScoreRing";
import RingButton from "@/components/stage/RingButton";
import { STAGE_CHIP, stageTone } from "@/lib/mastery";
import { buildRecap, type RecapDot, type RecapNext, type RecapView } from "@/lib/recap";
import { getRecap, type SessionRecapResponse } from "@/lib/api";
import type { SessionLog } from "@/lib/sessionLog";

/** 120×28 sparkline: graded takes as a line; unclear / out-of-tune as hollow dots on the baseline. */
export function Sparkline({ dots }: { dots: RecapDot[] }) {
  const W = 120;
  const H = 28;
  const pad = 4;
  const n = dots.length;
  const x = (i: number) => (n <= 1 ? W / 2 : pad + (i * (W - 2 * pad)) / (n - 1));
  const y = (s: number) => H - pad - s * (H - 2 * pad);
  const filled = dots.map((d, i) => ({ d, i })).filter(({ d }) => !d.hollow && d.score != null);
  const path = filled.map(({ d, i }, k) => `${k ? "L" : "M"}${x(i).toFixed(1)},${y(d.score as number).toFixed(1)}`).join(" ");
  const graded = filled.length;
  const hollow = dots.filter((d) => d.hollow).length;
  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`${graded} graded take${graded === 1 ? "" : "s"}${hollow ? `, ${hollow} not sure` : ""}`}
      className="shrink-0"
      data-testid="sparkline"
    >
      <line x1={pad} x2={W - pad} y1={H - pad} y2={H - pad} stroke="rgba(243,234,216,0.12)" strokeWidth={1} />
      {graded > 1 && <path d={path} fill="none" stroke="#a3c6ab" strokeWidth={1.5} strokeLinejoin="round" />}
      {dots.map((d, i) =>
        d.hollow ? (
          <circle key={i} cx={x(i)} cy={H - pad} r={2.6} fill="none" stroke="rgba(243,234,216,0.55)" strokeWidth={1.2} data-dot="hollow" />
        ) : d.score != null ? (
          <circle key={i} cx={x(i)} cy={y(d.score)} r={2.6} fill={d.score >= 1 ? "#a3c6ab" : "#efc27a"} data-dot="filled" />
        ) : (
          <circle key={i} cx={x(i)} cy={H - pad} r={2} fill="rgba(243,234,216,0.35)" />
        ),
      )}
    </svg>
  );
}

interface LoaderProps {
  log: SessionLog;
  signedIn: boolean;
  localNext: RecapNext | null;
  onNext: (href: string) => void;
  onKeepGoing: () => void;
  onDone: () => void;
}

/**
 * Lazy-loaded by the practice page: fetches the server recap when signed in
 * (falls back to the local log on any error) and renders it.
 */
export default function SessionRecapLoader({ log, signedIn, localNext, ...rest }: LoaderProps) {
  const [view, setView] = useState<RecapView | null>(() => (signedIn ? null : buildRecap(log, null, localNext)));
  const [loading, setLoading] = useState(signedIn);
  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;
    getRecap(log.startedAt)
      .catch(() => undefined as SessionRecapResponse | undefined)
      .then((server) => {
        if (cancelled) return;
        setView(buildRecap(log, server ?? null, localNext));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // the log is a snapshot taken when the recap opened
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn]);
  return <SessionRecap view={view} loading={loading} signedIn={signedIn} {...rest} />;
}

interface Props {
  view: RecapView | null;
  /** Server recap still loading (signed in): reserve the rows' space. */
  loading?: boolean;
  signedIn: boolean;
  onNext: (href: string) => void;
  onKeepGoing: () => void;
  onDone: () => void;
}

/** End-of-session summary: one headline, a row per chord, one insight, one next step. */
export function SessionRecap({ view, loading, signedIn, onNext, onKeepGoing, onDone }: Props) {
  const h1 = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    h1.current?.focus({ preventScroll: false });
  }, [view?.headline]);

  return (
    <section className="space-y-5" aria-labelledby="recap-title" data-testid="session-recap">
      <header className="space-y-1">
        <p className="text-meta uppercase text-gray-500">Session recap</p>
        <h1 id="recap-title" ref={h1} tabIndex={-1} className="font-display text-h2 gradient-text outline-none min-h-[2.5rem] text-balance">
          {view?.headline ?? "Your session"}
        </h1>
        <p className="text-sm text-gray-400 min-h-[1.25rem]">
          {view ? `${view.minutes} min · ${view.takes} take${view.takes === 1 ? "" : "s"}` : ""}
        </p>
      </header>

      <ul className="space-y-2" aria-busy={loading || undefined}>
        {loading && !view
          ? [0, 1].map((i) => <li key={i} className="glass rounded-2xl h-[84px] animate-pulse" />)
          : view?.rows.map((r, i) => (
              <li
                key={r.chordKey}
                className="glass rounded-2xl px-3 py-3 sm:px-4 flex flex-wrap items-center gap-x-4 gap-y-2 animate-enter"
                style={{ "--i": i } as React.CSSProperties}
                data-testid="recap-row"
              >
                <div className="w-14 h-14 shrink-0 flex items-center justify-center">
                  {r.bestScore != null ? (
                    <ScoreRing score={r.bestScore} size={56} strokeWidth={4} />
                  ) : (
                    <span className="w-14 h-14 rounded-full border border-dashed border-white/15" aria-hidden />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="font-display text-h2 text-cream leading-tight">{r.symbol}</h2>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    <span
                      className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                        STAGE_CHIP[r.stage ? stageTone(r.stage) : "neutral"]
                      }`}
                    >
                      {r.stageText}
                    </span>
                    {r.flags.map((f) => (
                      <span key={f} className="inline-flex rounded-full border border-amber-300/40 bg-amber-300/10 px-2 py-0.5 text-[11px] font-semibold text-amber-200">
                        {f}
                      </span>
                    ))}
                    {r.notSure > 0 && (
                      <span className="inline-flex rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-gray-400">
                        Not sure ×{r.notSure}
                      </span>
                    )}
                  </div>
                </div>
                <Sparkline dots={r.dots} />
              </li>
            ))}
      </ul>

      {view && view.drills.length > 0 && (
        <p className="text-sm text-gray-300">
          <span className="text-gray-500">Changes: </span>
          {view.drills.join(" · ")}
        </p>
      )}

      {view && <p className="text-base text-gray-200 leading-relaxed" data-testid="recap-insight">{view.insight}</p>}

      <div className="flex flex-col sm:flex-row items-center gap-4 border-t border-white/10 pt-5">
        {view?.next ? (
          <RingButton
            variant="primary"
            label={`Next: ${view.next.label} →`}
            onClick={() => onNext(view.next!.href)}
            size={132}
          />
        ) : null}
        <div className="flex flex-col items-center sm:items-start gap-2 text-sm">
          <button type="button" onClick={onKeepGoing} className="text-gray-300 hover:text-amber-200 underline underline-offset-4 decoration-white/20">
            Keep practising
          </button>
          <button type="button" onClick={onDone} className="text-gray-500 hover:text-gray-300">
            Done for today
          </button>
        </div>
      </div>

      {signedIn ? (
        <p className="text-sm text-gray-400 h-5" data-testid="recap-streak">
          {view?.streak != null ? (view.streak > 0 ? `Day ${view.streak} streak` : "") : <span className="inline-block h-4 w-28 rounded bg-white/5 align-middle" />}
        </p>
      ) : (
        <p className="text-sm text-gray-300">
          <Link href="/signup?next=/practice" className="text-amber-200 underline underline-offset-4">
            Save this progress — create a free account
          </Link>
        </p>
      )}
    </section>
  );
}
