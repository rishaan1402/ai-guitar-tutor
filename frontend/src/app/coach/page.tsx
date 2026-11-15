"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  clearGoal, coachChat, getGoal, getWeeklyReport, setGoal,
  type CoachAction, type GoalPlan, type WeeklyReport,
} from "@/lib/api";
import { toAppChordKey } from "@/lib/chordpro";
import { prettySymbol } from "@/lib/chordShape";
import { grooveHref } from "@/lib/groove/link";
import ReportContent from "@/components/report/ReportContent";
import WeeklyCard from "@/components/coach/WeeklyCard";
import { actionHref } from "@/lib/coachLinks";

type Msg = { role: "user" | "assistant"; content: string; actions?: CoachAction[] };
const STORE = "os:coach-chat";
const QUICK = ["What should I practise today?", "Why does my F chord buzz?", "How do I change chords faster?", "Make me a bluesy Groove"];

export default function CoachPage() {
  return (
    <Suspense fallback={null}>
      <Coach />
    </Suspense>
  );
}

function Coach() {
  const params = useSearchParams();
  const [tab, setTab] = useState<"chat" | "goal" | "week">((params.get("tab") as "goal" | "week") || "chat");
  return (
    <main className="flex min-h-[100dvh] flex-col bg-ink-950 px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))]">
      <div className="flex items-center justify-between">
        <Link href="/studio" className="label-mono text-cream/50">← Studio</Link>
      </div>
      <p className="label-mono mt-4 text-amber-400">Your coach</p>
      <h1 className="mt-1 font-display text-h1 uppercase text-cream">Coach</h1>
      <div className="mt-4 grid grid-cols-3 gap-1 rounded-full border border-cream/10 p-1" role="tablist">
        {(["chat", "goal", "week"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`h-10 rounded-full text-sm font-semibold ${tab === t ? "bg-amber-400 text-ink-950" : "text-cream/70"}`}
          >
            {t === "chat" ? "Ask" : t === "goal" ? "Goal" : "This week"}
          </button>
        ))}
      </div>
      <div className="mt-4 flex min-h-0 flex-1 flex-col">
        {tab === "chat" && <Chat initial={params.get("q")} />}
        {tab === "goal" && <Goal />}
        {tab === "week" && <Week />}
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ chat */

function Chat({ initial }: { initial: string | null }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const sent = useRef(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      setMsgs(JSON.parse(sessionStorage.getItem(STORE) || "[]"));
    } catch {
      /* fresh chat */
    }
  }, []);
  useEffect(() => {
    try {
      sessionStorage.setItem(STORE, JSON.stringify(msgs.slice(-20)));
    } catch {
      /* storage blocked */
    }
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs]);

  async function send(q: string) {
    const question = q.trim();
    if (!question || busy) return;
    const next: Msg[] = [...msgs, { role: "user", content: question }];
    setMsgs(next);
    setText("");
    setBusy(true);
    try {
      const r = await coachChat(next.slice(-10).map(({ role, content }) => ({ role, content })));
      setMsgs((m) => [...m, { role: "assistant", content: r.reply, actions: r.actions }]);
    } catch {
      setMsgs((m) => [...m, { role: "assistant", content: "I couldn't reach the coach just now. Check your connection and ask again." }]);
    } finally {
      setBusy(false);
    }
  }

  // a question handed over from a results screen
  useEffect(() => {
    if (initial && !sent.current) {
      sent.current = true;
      void send(initial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pb-3" aria-live="polite">
        {msgs.length === 0 && (
          <div className="rounded-2xl border border-cream/10 p-4 text-cream/70">
            Ask anything about your playing. I can see your chords, your scores and which changes are slow, so I can be specific.
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : ""}>
            <div className={`max-w-[88%] rounded-2xl px-4 py-3 ${m.role === "user" ? "bg-amber-400 text-ink-950" : "border border-cream/10 bg-cream/[0.04] text-cream/90"}`}>
              <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{m.content}</p>
              {m.actions && m.actions.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {m.actions.map((a, k) => (
                    <Link key={k} href={actionHref(a)} className="rounded-full bg-amber-400/90 px-3 py-1.5 text-sm font-semibold text-ink-950">
                      {a.label} →
                    </Link>
                  ))}
                </div>
              )}
              {m.role === "assistant" && <ReportContent kind="tip" content={m.content} className="mt-2 block" />}
            </div>
          </div>
        ))}
        {busy && <p className="label-mono animate-pulse text-cream/50">Coach is thinking…</p>}
        <div ref={end} />
      </div>
      {msgs.length === 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {QUICK.map((q) => (
            <button key={q} onClick={() => send(q)} className="rounded-full border border-cream/15 px-3 py-1.5 text-sm text-cream/80">{q}</button>
          ))}
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(text);
        }}
        className="flex gap-2 pb-[env(safe-area-inset-bottom)]"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
          placeholder="Ask your coach…"
          aria-label="Ask your coach"
          className="field-input h-12 flex-1"
        />
        <button disabled={busy || !text.trim()} className="h-12 rounded-full bg-amber-400 px-5 font-semibold text-ink-950 disabled:opacity-50">Send</button>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------ goal */

function SignInFirst({ what }: { what: string }) {
  return (
    <div className="rounded-2xl border border-cream/10 p-5 text-cream/75">
      Sign in to {what}.{" "}
      <Link href="/login?next=/coach" className="text-amber-300 underline underline-offset-4">Log in</Link>
    </div>
  );
}

function Goal() {
  const { user } = useAuth();
  const router = useRouter();
  const [goal, setGoalState] = useState<GoalPlan | null | undefined>(undefined);
  const [title, setTitle] = useState("");
  const [chords, setChords] = useState("");
  const [weeks, setWeeks] = useState(3);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) getGoal().then(setGoalState).catch(() => setGoalState(null));
  }, [user]);
  if (!user) return <SignInFirst what="set a goal" />;
  if (goal === undefined) return <p className="label-mono text-cream/50">Loading…</p>;

  if (!goal) {
    return (
      <form
        className="space-y-4 rounded-2xl border border-cream/10 p-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          const list = chords.split(/[\s,|]+/).filter(Boolean);
          if (!title.trim() || !list.length) return setError("Add the song and its chords.");
          setSaving(true);
          try {
            setGoalState(await setGoal(title.trim(), list, weeks * 7));
          } catch (err) {
            setError(err instanceof Error ? err.message : "Couldn't save the goal.");
          } finally {
            setSaving(false);
          }
        }}
      >
        <p className="text-cream/75">Pick a song and a date. You get a plan for every day until then.</p>
        <label className="block">
          <span className="field-label">Song</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="e.g. my cousin's wedding song" className="field-input" />
        </label>
        <label className="block">
          <span className="field-label">Its chords</span>
          <input value={chords} onChange={(e) => setChords(e.target.value)} placeholder="G D Em C" className="field-input font-mono" />
          <span className="mt-1 block text-xs text-cream/45">
            Don&apos;t know them? <Link href="/practice?mode=song" className="text-amber-300">Learn any song</Link> gives you the chart.
          </span>
        </label>
        <label className="block">
          <span className="field-label">In {weeks} week{weeks > 1 ? "s" : ""}</span>
          <input type="range" min={1} max={8} value={weeks} onChange={(e) => setWeeks(Number(e.target.value))} className="w-full accent-amber-400" />
        </label>
        {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
        <button disabled={saving} className="h-12 w-full rounded-full bg-amber-400 font-semibold text-ink-950 disabled:opacity-50">{saving ? "Planning…" : "Make my plan"}</button>
      </form>
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const todayPlan = goal.plan.days.find((d) => d.date === today) ?? goal.plan.days[0];
  const daysLeft = Math.max(0, Math.round((new Date(goal.target_date).getTime() - Date.now()) / 86400000));
  const songGroove = { id: "goal-song", title: goal.title.slice(0, 60), style: "pop" as const, bpm: 72, bars: goal.chords.map((c) => [c]), strum: "D.D.D.DU", loops: 2, source: "song", mode: "follow" as const };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-amber-400/30 bg-amber-400/[0.05] p-4">
        <p className="label-mono text-amber-400">{daysLeft} day{daysLeft === 1 ? "" : "s"} to go</p>
        <h2 className="mt-1 font-display text-2xl uppercase text-cream">{goal.title}</h2>
        <p className="mt-1 font-mono text-sm text-cream/60">{goal.chords.map(prettySymbol).join("  ")}</p>
      </div>
      <div className="rounded-2xl border border-cream/10 p-4">
        <p className="font-semibold text-cream">Today</p>
        <ul className="mt-2 space-y-2">
          {todayPlan?.tasks.map((t, i) => (
            <li key={i}>
              <button
                onClick={() =>
                  router.push(
                    t.type === "learn" && t.chord
                      ? `/practice?chord=${encodeURIComponent(toAppChordKey(t.chord) ?? "")}`
                      : t.type === "groove" && t.focus
                        ? `/groove?ai=1&focus=${t.focus.join(",")}`
                        : grooveHref(songGroove),
                  )
                }
                className="flex w-full items-center justify-between rounded-xl border border-cream/10 px-3 py-2.5 text-left text-cream"
              >
                <span>{t.label.replace(/->|→/g, "→")}</span>
                <span className="text-amber-300">→</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <details className="rounded-2xl border border-cream/10 p-4 text-sm text-cream/70">
        <summary className="cursor-pointer font-semibold text-cream">The whole plan</summary>
        <ol className="mt-3 space-y-1.5">
          {goal.plan.days.map((d) => (
            <li key={d.date} className={d.date === today ? "text-amber-200" : ""}>
              <span className="label-mono mr-2 text-cream/40">{d.date.slice(5)}</span>
              {d.tasks.map((t) => t.label).join(" · ")}
            </li>
          ))}
        </ol>
      </details>
      <button onClick={async () => { await clearGoal().catch(() => {}); setGoalState(null); }} className="text-sm text-cream/45 underline-offset-4 hover:underline">
        Remove this goal
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ weekly report */

function Week() {
  const { user } = useAuth();
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (user) getWeeklyReport().then(setReport).catch(() => setError(true));
  }, [user]);
  if (!user) return <SignInFirst what="see your weekly report" />;
  if (error) return <p className="text-cream/60">Couldn&apos;t load this week&apos;s report.</p>;
  if (!report) return <p className="label-mono animate-pulse text-cream/50">Writing your report…</p>;
  return <WeeklyCard report={report} />;
}
