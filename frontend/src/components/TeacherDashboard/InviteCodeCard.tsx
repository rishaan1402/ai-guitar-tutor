"use client";

import { useEffect, useState } from "react";
import { getInviteCode, rotateInviteCode } from "@/lib/api";

export default function InviteCodeCard() {
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getInviteCode()
      .then((r) => setCode(r.code))
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load code"));
  }, []);

  const handleCopy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked; the code is still visible to copy by hand
    }
  };

  const handleRotate = async () => {
    if (!window.confirm("Make a new code? The old one stops working, but students already in your class stay.")) {
      return;
    }
    setBusy(true);
    try {
      setCode((await rotateInviteCode()).code);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not rotate code");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="glass-card mb-6 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
      <div>
        <p className="text-sm text-gray-400">Class invite code</p>
        <p className="text-xs text-gray-500 mt-0.5">
          Students enter this on their dashboard to join. You only see students who joined.
        </p>
        {error && <p className="text-xs text-red-300 mt-1">{error}</p>}
      </div>
      <div className="flex items-center gap-3">
        <span className="font-mono text-2xl tracking-[0.2em] text-white" aria-live="polite">
          {code ?? "········"}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          disabled={!code}
          className="py-1.5 px-3 rounded-lg border border-white/10 text-gray-300 text-sm hover:bg-white/5 disabled:opacity-50"
        >
          {copied ? "Copied" : "Copy"}
        </button>
        <button
          type="button"
          onClick={handleRotate}
          disabled={busy || !code}
          className="py-1.5 px-3 rounded-lg border border-white/10 text-gray-400 text-sm hover:bg-white/5 disabled:opacity-50"
        >
          New code
        </button>
      </div>
    </div>
  );
}
