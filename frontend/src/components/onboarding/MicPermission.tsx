"use client";

import { useEffect, useState } from "react";
import RingButton from "@/components/stage/RingButton";
import { micErrorKind, micErrorMessage, openMic } from "@/lib/mic";
import { micHelp } from "@/lib/micHelp";

interface Props {
  onGranted: (stream: MediaStream) => void;
  onWithoutMic: () => void;
}

/** Step 1: one sentence, one button; browser-specific recovery when blocked. */
export default function MicPermission({ onGranted, onWithoutMic }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [ua, setUa] = useState("");
  useEffect(() => setUa(navigator.userAgent), []);

  async function ask() {
    setBusy(true);
    setError(null);
    try {
      const stream = await openMic();
      onGranted(stream);
    } catch (err) {
      setError(err ?? new Error("denied"));
    } finally {
      setBusy(false);
    }
  }

  const denied = error !== null && micErrorKind(error) === "denied";
  const help = micHelp(ua);

  return (
    <div className="flex flex-col items-center text-center gap-6" data-testid="step-permission">
      <p className="text-body text-gray-300 max-w-md">
        I listen through your mic; nothing is recorded until you strum.
      </p>
      {error === null ? (
        <RingButton variant="primary" label={busy ? "Waiting…" : "Allow mic"} onClick={ask} disabled={busy} size={140} />
      ) : (
        <div className="w-full max-w-md rounded-2xl border border-amber-300/30 bg-amber-300/[0.05] p-4 text-left space-y-3" role="alert" data-testid="mic-recovery">
          <p className="text-sm font-semibold text-amber-200">{micErrorMessage(error)}</p>
          {denied && (
            <ol className="list-decimal pl-5 space-y-1 text-sm text-gray-300">
              {help.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          )}
          <button
            type="button"
            onClick={ask}
            disabled={busy}
            className="rounded-xl bg-amber-400 text-[#1c1206] px-4 py-2 text-sm font-semibold hover:bg-amber-300 disabled:opacity-50"
          >
            Try again
          </button>
        </div>
      )}
      <button
        type="button"
        onClick={onWithoutMic}
        className="text-sm text-gray-400 hover:text-gray-200 underline underline-offset-4 decoration-white/20"
      >
        Continue without mic (watch &amp; listen only)
      </button>
    </div>
  );
}
