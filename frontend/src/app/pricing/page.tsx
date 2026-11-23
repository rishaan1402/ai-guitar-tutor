"use client";

/**
 * Pricing, honestly: everything is free today. Pro is planned; each visitor sees
 * one of two prices, and "Tell me when it's ready" tells us which price people
 * would pay. Nothing is sold here and nothing is locked.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import NavBar from "@/components/NavBar";
import { getAccessToken } from "@/lib/auth";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const PRICES = { A: { monthly: 4.99, yearly: 39.99 }, B: { monthly: 7.99, yearly: 59.99 } } as const;
type Variant = keyof typeof PRICES;
type Plan = "monthly" | "yearly";

function variantForThisVisitor(): Variant {
  try {
    const kept = localStorage.getItem("os:price-variant");
    if (kept === "A" || kept === "B") return kept;
    const v: Variant = Math.random() < 0.5 ? "A" : "B";
    localStorage.setItem("os:price-variant", v);
    return v;
  } catch {
    return "A";
  }
}

const FREE = [
  "Every lesson in all four tracks",
  "Any chord: watch it, play it, feedback on every string",
  "Learn any song: chart, section lessons, play-along",
  "Tuner, strum trainer, grooves, chord sheets",
  "Progress, streaks and reminders",
];
const PRO = [
  "Unlimited new song lessons (free has an hourly limit)",
  "A coach that remembers your whole history",
  "Practice plans built around the songs you want to play",
  "Offline song lessons in the app",
  "Support an independent guitar app",
];

export default function PricingPage() {
  const [variant, setVariant] = useState<Variant | null>(null);
  const [plan, setPlan] = useState<Plan>("yearly");
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    const v = variantForThisVisitor();
    setVariant(v);
    setSignedIn(!!getAccessToken());
    try {
      if (sessionStorage.getItem("os:price-viewed")) return;
      sessionStorage.setItem("os:price-viewed", "1");
    } catch {
      /* storage blocked: count it anyway */
    }
    fetch(`${API}/api/pricing/view`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ variant: v }) }).catch(() => {});
  }, []);

  const p = variant ? PRICES[variant] : null;
  const perMonthYearly = p ? (p.yearly / 12).toFixed(2) : "";

  const join = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!variant) return;
    setState("sending");
    try {
      const token = getAccessToken();
      const res = await fetch(`${API}/api/pricing/interest`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ variant, plan, email: email.trim() || undefined }),
      });
      setState(res.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  };

  return (
    <main className="min-h-screen bg-ink-950">
      <NavBar />
      <div className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
        <p className="label-mono text-amber-300">Pricing</p>
        <h1 className="mt-2 font-display text-h1 uppercase text-cream">Free while we build it</h1>
        <p className="mt-3 max-w-2xl text-cream/75">
          Everything in Open Strings is free today, and the core will stay free. Pro is coming for people who want more.
          Tell us if you&apos;d pay for it; nothing is charged here.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
          <section aria-labelledby="free-h" className="rounded-[26px] border border-cream/10 bg-ink-900/60 p-6">
            <h2 id="free-h" className="font-display text-xl uppercase text-cream">Free</h2>
            <p className="mt-1 text-3xl font-semibold text-cream">$0</p>
            <ul className="mt-4 space-y-2 text-cream/80">
              {FREE.map((f) => (
                <li key={f} className="flex gap-2"><span aria-hidden="true" className="text-sage-300">✓</span>{f}</li>
              ))}
            </ul>
            <Link href="/studio" className="mt-6 inline-flex rounded-full border border-cream/20 px-5 py-2.5 text-cream">Start playing</Link>
          </section>

          <section aria-labelledby="pro-h" className="rounded-[26px] border border-amber-400/50 bg-amber-400/5 p-6">
            <div className="flex items-baseline justify-between gap-3">
              <h2 id="pro-h" className="font-display text-xl uppercase text-cream">Pro</h2>
              <span className="label-mono text-[10px] text-amber-300">Coming soon</span>
            </div>
            {p && (
              <div className="mt-2" role="radiogroup" aria-label="Billing">
                <div className="flex gap-2">
                  {(["yearly", "monthly"] as Plan[]).map((pl) => (
                    <button
                      key={pl}
                      type="button"
                      role="radio"
                      aria-checked={plan === pl}
                      onClick={() => setPlan(pl)}
                      className={`rounded-full border px-3 py-1 text-sm ${plan === pl ? "border-amber-400 bg-amber-400/15 text-amber-100" : "border-cream/15 text-cream/75"}`}
                    >
                      {pl === "yearly" ? "Yearly" : "Monthly"}
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-3xl font-semibold text-cream">
                  {plan === "yearly" ? `$${p.yearly}` : `$${p.monthly}`}
                  <span className="ml-1 text-base font-normal text-cream/70">{plan === "yearly" ? `a year ($${perMonthYearly}/month)` : "a month"}</span>
                </p>
              </div>
            )}
            <ul className="mt-4 space-y-2 text-cream/80">
              {PRO.map((f) => (
                <li key={f} className="flex gap-2"><span aria-hidden="true" className="text-amber-300">+</span>{f}</li>
              ))}
            </ul>
            {state === "done" ? (
              <p role="status" className="mt-6 rounded-2xl border border-sage-300/40 bg-sage-300/10 p-3 text-sm text-sage-100">
                Thanks: that helps us decide. {email.trim() || signedIn ? "We'll let you know when Pro is ready." : ""} Everything stays free in the meantime.
              </p>
            ) : (
              <form onSubmit={join} className="mt-6 space-y-2">
                {!signedIn && (
                  <>
                    <label htmlFor="pro-email" className="block text-sm text-cream/75">Email (optional, to hear when it&apos;s ready)</label>
                    <input id="pro-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="you@example.com" className="h-11 w-full rounded-full border border-cream/15 bg-transparent px-4 text-cream placeholder:text-cream/40" />
                  </>
                )}
                <button disabled={state === "sending" || !variant} className="h-12 w-full rounded-full bg-amber-400 font-semibold text-ink-950 disabled:opacity-50">
                  {state === "sending" ? "Sending…" : "I'd pay for this: tell me when it's ready"}
                </button>
                {state === "error" && <p role="alert" className="text-sm text-amp-300">That didn&apos;t go through. Check the email and try again.</p>}
                <p className="text-xs text-cream/60">No payment, no card. We only use your email to tell you about Pro, and you can ask us to delete it.</p>
              </form>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
