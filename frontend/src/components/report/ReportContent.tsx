"use client";

import { useId, useState } from "react";
import { reportContent, type ReportKind, type ReportReason } from "@/lib/api";

const REASONS: { value: ReportReason; label: string }[] = [
  { value: "wrong", label: "It's wrong" },
  { value: "offensive", label: "Offensive" },
  { value: "unsafe", label: "Unsafe or harmful" },
  { value: "copyright", label: "Copied content (e.g. lyrics)" },
  { value: "other", label: "Something else" },
];

interface Props {
  kind: ReportKind;
  /** The exact AI-written text being reported. */
  content: string;
  /** Chord key or song name, so we can reproduce it. */
  context?: string;
  className?: string;
}

/** Small "Report" link for AI-written text (Google Play's AI-generated content policy). */
export default function ReportContent({ kind, content, context, className }: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>("wrong");
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const id = useId();

  if (state === "sent") {
    return <p className={`text-xs text-cream/50 ${className ?? ""}`} role="status">Thanks — we&apos;ll look at it.</p>;
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`text-xs text-cream/40 underline-offset-4 hover:text-cream/70 hover:underline ${className ?? ""}`}
      >
        Report this AI response
      </button>
    );
  }

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("sending");
    try {
      await reportContent({ kind, reason, content, context, note: note.trim() || undefined });
      setState("sent");
    } catch {
      setState("error");
    }
  };

  return (
    <form onSubmit={send} className={`space-y-3 rounded-xl border border-cream/10 bg-ink-900/60 p-3 text-sm ${className ?? ""}`}>
      <fieldset>
        <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-cream/60">What&apos;s the problem?</legend>
        <div className="flex flex-wrap gap-2">
          {REASONS.map((r) => (
            <label
              key={r.value}
              className={`cursor-pointer rounded-full border px-3 py-1 text-xs ${
                reason === r.value ? "border-amber-400 bg-amber-400/15 text-amber-100" : "border-cream/15 text-cream/70"
              }`}
            >
              <input
                type="radio"
                name={`${id}-reason`}
                value={r.value}
                checked={reason === r.value}
                onChange={() => setReason(r.value)}
                className="sr-only"
              />
              {r.label}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block">
        <span className="sr-only">Details (optional)</span>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          placeholder="Details (optional)"
          className="field-input text-sm"
        />
      </label>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={state === "sending"} className="rounded-full bg-amber-400 px-4 py-1.5 text-xs font-semibold text-ink-950 disabled:opacity-50">
          {state === "sending" ? "Sending…" : "Send report"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-cream/50 hover:text-cream">
          Cancel
        </button>
        {state === "error" && <span className="text-xs text-red-300" role="alert">Couldn&apos;t send — try again.</span>}
      </div>
    </form>
  );
}
