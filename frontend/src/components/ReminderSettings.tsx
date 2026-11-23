"use client";

/** Daily practice reminder: on/off and the hour. The app schedules it on the phone; browsers use push. */
import { useEffect, useState } from "react";
import { currentReminder, reminderSupport, setReminder } from "@/lib/reminders";

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const label = (h: number) => new Date(2000, 0, 1, h).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

export default function ReminderSettings() {
  const [hour, setHour] = useState<number | null>(null);
  const [pick, setPick] = useState(19);
  const [kind, setKind] = useState<"app" | "web" | "none">("none");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    setKind(reminderSupport());
    const h = currentReminder().hour;
    setHour(h);
    if (h !== null) setPick(h);
  }, []);

  const apply = async (h: number | null) => {
    setBusy(true);
    setMsg(null);
    try {
      await setReminder(h);
      setHour(h);
      setMsg({ ok: true, text: h === null ? "Reminders are off." : `Every day at ${label(h)}, unless you've already played.` });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Couldn't change the reminder." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="reminder-h" className="glass-card p-6">
      <h2 id="reminder-h" className="text-lg font-semibold text-white">Practice reminder</h2>
      <p className="mt-1 text-sm text-cream/70">
        A nudge once a day, only on days you haven&apos;t played yet. Seven days in a row earns a rest day that keeps your streak if you miss one.
      </p>
      {kind === "none" ? (
        <p className="mt-4 text-sm text-cream/70">This browser can&apos;t show reminders. Install the app, or use Chrome, Edge, Firefox or Safari 16.4+.</p>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label htmlFor="reminder-hour" className="text-sm text-cream/80">At</label>
          <select id="reminder-hour" value={pick} onChange={(e) => setPick(Number(e.target.value))} className="h-10 rounded-full border border-cream/15 bg-ink-950 px-3 text-cream">
            {HOURS.map((h) => (
              <option key={h} value={h}>{label(h)}</option>
            ))}
          </select>
          <button type="button" disabled={busy} onClick={() => apply(pick)} className="h-10 rounded-full bg-amber-400 px-5 font-semibold text-ink-950 disabled:opacity-50">
            {hour === null ? "Remind me" : hour === pick ? "Reminder on ✓" : "Change time"}
          </button>
          {hour !== null && (
            <button type="button" disabled={busy} onClick={() => apply(null)} className="h-10 rounded-full border border-cream/20 px-4 text-sm text-cream/85">
              Turn off
            </button>
          )}
        </div>
      )}
      {msg && <p role={msg.ok ? "status" : "alert"} className={`mt-3 text-sm ${msg.ok ? "text-sage-200" : "text-amp-300"}`}>{msg.text}</p>}
    </section>
  );
}
