import Link from "next/link";
import { MarketingNav } from "@/components/layout/MarketingNav";
import { Footer } from "@/components/layout/Footer";

const FEATURES = [
  {
    icon: "🎧",
    title: "Real-time pitch listening",
    desc: "Play into your mic and get instant note-by-note detection — no guessing whether you nailed the chord.",
  },
  {
    icon: "🖐️",
    title: "Interactive fingering diagrams",
    desc: "See exactly where every finger goes, with live overlays that show what you actually played.",
  },
  {
    icon: "🎵",
    title: "Learn through real songs",
    desc: "Pick a song, get a chord-by-chord lesson plan, and practice transitions in context instead of in isolation.",
  },
  {
    icon: "🔄",
    title: "Chord transition trainer",
    desc: "Drill the switches that actually slow beginners down, with timing feedback on every change.",
  },
  {
    icon: "📈",
    title: "Progress that sticks",
    desc: "Streaks, mastery scores, and a 365-day activity map keep you honest about how often you actually practiced.",
  },
  {
    icon: "🧑‍🏫",
    title: "Built for classrooms too",
    desc: "Teachers assign chords, track a whole class, and get AI-generated progress reports per student.",
  },
];

const STEPS = [
  { n: "01", label: "Watch", desc: "A short video breaks down the chord before you touch the strings." },
  { n: "02", label: "Listen", desc: "Hear exactly what a clean version of the chord should sound like." },
  { n: "03", label: "Play", desc: "Play it yourself while the AI listens through your microphone." },
  { n: "04", label: "Review", desc: "Get scored feedback on missing or extra notes, plus fingering tips." },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <MarketingNav />

      {/* ── HERO ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
            maskImage: "radial-gradient(ellipse 70% 60% at 50% 0%, black, transparent)",
            WebkitMaskImage: "radial-gradient(ellipse 70% 60% at 50% 0%, black, transparent)",
          }}
        />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 sm:pt-28 pb-20 text-center">
          <div
            className="inline-flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full glass border border-white/10 text-purple-300 mb-6"
            style={{ animation: "fade-in-up 0.5s ease-out both" }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse-glow" />
            AI listens while you play
          </div>

          <h1
            className="text-4xl sm:text-6xl font-black tracking-tight leading-[1.05]"
            style={{ animation: "fade-in-up 0.5s ease-out 0.05s both" }}
          >
            Learn guitar chords with
            <br />
            <span className="gradient-text">feedback that actually listens</span>
          </h1>

          <p
            className="text-gray-400 text-lg max-w-xl mx-auto mt-6"
            style={{ animation: "fade-in-up 0.5s ease-out 0.1s both" }}
          >
            Watch, listen, play, and get scored on what your microphone actually hears —
            not just whether you clicked &quot;done&quot;.
          </p>

          <div
            className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-9"
            style={{ animation: "fade-in-up 0.5s ease-out 0.15s both" }}
          >
            <Link href="/signup" className="btn-gradient px-7 py-3 text-base w-full sm:w-auto">
              Start Practicing Free
            </Link>
            <Link
              href="/practice"
              className="btn-outline px-7 py-3 text-base w-full sm:w-auto"
            >
              Try it without an account →
            </Link>
          </div>

          {/* Mock app preview */}
          <div
            className="glass-card mt-16 max-w-3xl mx-auto text-left p-0 overflow-hidden"
            style={{ animation: "fade-in-up 0.6s ease-out 0.2s both" }}
          >
            <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-400/60" />
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-400/60" />
              <span className="w-2.5 h-2.5 rounded-full bg-green-400/60" />
              <span className="ml-3 text-xs text-gray-500">AI Guitar Tutor — G Major</span>
            </div>
            <div className="p-6 sm:p-8 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-6 items-center">
              <div>
                <div className="text-xs text-purple-300 mb-2">Step 3 of 4 — Play</div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center bg-red-500/20 border border-red-500/40 animate-recording-pulse">
                    <span className="w-3 h-3 rounded-full bg-red-400" />
                  </div>
                  <div className="text-sm text-gray-300">Listening for G, B, D…</div>
                </div>
                <div className="flex gap-2">
                  {["G", "B", "D"].map((n) => (
                    <span
                      key={n}
                      className="text-xs font-mono px-2.5 py-1 rounded-md bg-green-500/15 border border-green-500/40 text-green-300"
                    >
                      {n} ✓
                    </span>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-6 gap-1 shrink-0">
                {Array.from({ length: 24 }).map((_, i) => (
                  <span
                    key={i}
                    className="w-3 h-3 rounded-sm"
                    style={{
                      background:
                        [2, 8, 15, 20].includes(i)
                          ? "rgba(139,92,246,0.7)"
                          : "rgba(255,255,255,0.06)",
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── QUICK FACTS ──────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 -mt-4 sm:-mt-6 pb-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Guided steps per chord", value: "4" },
            { label: "Feedback source", value: "Your mic" },
            { label: "Practice modes", value: "3" },
            { label: "Account required", value: "No" },
          ].map((s) => (
            <div key={s.label} className="glass-card text-center py-5">
              <div className="text-2xl font-bold gradient-text">{s.value}</div>
              <div className="text-xs text-gray-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ─────────────────────────────────────────── */}
      <section id="features" className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="text-center max-w-xl mx-auto mb-14">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Everything you need, <span className="gradient-text">nothing you don&apos;t</span>
          </h2>
          <p className="text-gray-400 mt-3">
            A focused practice loop, not another video library you&apos;ll forget to open.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f) => (
            <div key={f.title} className="glass-card glass-hover">
              <div className="text-2xl mb-3">{f.icon}</div>
              <h3 className="font-semibold text-white mb-1.5">{f.title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────── */}
      <section id="how-it-works" className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center max-w-xl mx-auto mb-14">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            One chord, <span className="gradient-text">four steps</span>
          </h2>
          <p className="text-gray-400 mt-3">
            The same loop every time, so practicing becomes a habit instead of a decision.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {STEPS.map((s, i) => (
            <div key={s.label} className="glass-card relative">
              <div className="text-xs font-mono text-purple-400/70 mb-3">{s.n}</div>
              <h3 className="font-semibold text-white mb-1.5">{s.label}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{s.desc}</p>
              {i < STEPS.length - 1 && (
                <span className="hidden lg:block absolute top-1/2 -right-3 -translate-y-1/2 text-gray-700">
                  →
                </span>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── FOR TEACHERS ─────────────────────────────────────── */}
      <section id="for-teachers" className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="glass-card p-8 sm:p-12 grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-300 mb-4">
              For Teachers
            </div>
            <h2 className="text-3xl font-extrabold tracking-tight mb-4">
              Run a whole classroom without losing the personal touch
            </h2>
            <p className="text-gray-400 leading-relaxed mb-6">
              Assign specific chords to students, watch class-wide analytics on what&apos;s
              working and what isn&apos;t, and generate AI progress reports per student in
              seconds instead of hours.
            </p>
            <Link href="/signup" className="btn-gradient px-6 py-2.5 inline-block">
              Set up a class
            </Link>
          </div>
          <div className="space-y-3">
            {[
              "Assign chords with a note in one click",
              "See most-practiced and lowest-scoring chords class-wide",
              "Generate an AI-written progress report per student",
            ].map((item) => (
              <div key={item} className="flex items-start gap-3 text-sm text-gray-300">
                <span className="mt-0.5 text-green-400">✓</span>
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ────────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
          Ready to see if you&apos;re <span className="gradient-text">actually</span> playing it right?
        </h2>
        <p className="text-gray-400 mb-8">
          No install, no credit card — just plug in a mic and play.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/signup" className="btn-gradient px-7 py-3 text-base w-full sm:w-auto">
            Start Practicing Free
          </Link>
          <Link href="/practice" className="btn-outline px-7 py-3 text-base w-full sm:w-auto">
            Try it without an account →
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
