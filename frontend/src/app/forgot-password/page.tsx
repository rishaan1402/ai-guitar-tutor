"use client";

import { useState } from "react";
import Link from "next/link";
import { requestPasswordReset } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not send reset email");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <Link href="/" className="flex items-center justify-center gap-2 mb-8">
          <span className="text-2xl">🎸</span>
          <span className="font-bold text-white">AI Guitar Tutor</span>
        </Link>

        <div className="glass-card" style={{ animation: "fade-in-up 0.4s ease-out both" }}>
          <h1 className="text-2xl font-bold text-white mb-1 text-center">Reset your password</h1>
          {sent ? (
            <p className="text-gray-300 text-sm text-center mt-4" role="status">
              If <span className="text-white">{email}</span> has an account, we&apos;ve sent a link
              to reset the password. It expires in 30 minutes.
            </p>
          ) : (
            <>
              <p className="text-gray-400 text-sm text-center mb-7">
                Enter your account email and we&apos;ll send you a reset link
              </p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="email" className="field-label">Email</label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="field-input"
                    placeholder="you@example.com"
                  />
                </div>

                {error && (
                  <p className="text-red-300 text-sm bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                    {error}
                  </p>
                )}

                <button type="submit" disabled={loading} className="btn-gradient w-full py-2.5">
                  {loading ? "Sending…" : "Send reset link"}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-gray-500 text-sm mt-6">
          <Link href="/login" className="text-purple-300 hover:text-purple-200 transition-colors">
            Back to log in
          </Link>
        </p>
      </div>
    </div>
  );
}
