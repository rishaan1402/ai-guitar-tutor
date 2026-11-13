import Link from "next/link";
import { MarketingNav } from "@/components/layout/MarketingNav";
import { Footer } from "@/components/layout/Footer";
import Room from "@/components/room/Room";
import Intro from "@/components/landing/Intro";
import VerdictDemo from "@/components/landing/VerdictDemo";
import ChartDemo from "@/components/landing/ChartDemo";
import MasteryDemo from "@/components/landing/MasteryDemo";
import { Reveal } from "@/components/stage/Reveal";

function Chapter({
  id,
  n,
  kicker,
  title,
  body,
  cta,
  children,
}: {
  id: string;
  n: string;
  kicker: string;
  title: React.ReactNode;
  body: string;
  cta?: { href: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 py-20 sm:py-28" aria-labelledby={`${id}-title`}>
      <Reveal>
        <div className="grid gap-6 md:grid-cols-[auto_1fr] md:gap-12">
          <span className="font-display text-6xl leading-none text-amber-400/25 sm:text-8xl" aria-hidden="true">
            {n}
          </span>
          <div className="max-w-2xl">
            <p className="label-mono text-amber-300">{kicker}</p>
            <h2 id={`${id}-title`} className="mt-3 font-display text-h2 uppercase leading-[0.95] text-cream">
              {title}
            </h2>
            <p className="mt-4 text-lg text-cream/70">{body}</p>
            {cta && (
              <Link href={cta.href} className="mt-6 inline-flex items-center gap-2 text-amber-300 hover:text-amber-200">
                {cta.label} <span aria-hidden="true">→</span>
              </Link>
            )}
          </div>
        </div>
      </Reveal>
      <Reveal delay={120} className="mt-10">
        {children}
      </Reveal>
    </section>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-ink-950">
      <Intro />
      <MarketingNav />

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* ── Hero: the room ─────────────────────────────────────── */}
        <section id="room" className="scroll-mt-20 pt-12 sm:pt-16" aria-labelledby="hero-title">
          <div className="grid items-end gap-6 lg:grid-cols-[1.2fr_1fr]">
            <h1 id="hero-title" className="font-display text-display uppercase text-cream">
              The practice room
              <br />
              <span className="text-amber-400">that listens.</span>
            </h1>
            <div className="lg:pb-3">
              <p className="text-lg text-cream/75">
                Play a chord into your mic and Open Strings hears every string — then tells you exactly what to fix.
                Name any song and it builds the chart, the tabs and the lessons.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/start" className="rounded-full bg-amber-400 px-6 py-3 font-semibold text-ink-950 transition hover:bg-amber-300">
                  Start in 30 seconds
                </Link>
                <Link href="/practice?mode=song" className="rounded-full border border-cream/20 px-6 py-3 font-semibold text-cream transition hover:border-amber-400/60 hover:text-amber-200">
                  Learn a song
                </Link>
              </div>
              <p className="label-mono mt-4 text-cream/40">No account needed · works in your browser</p>
            </div>
          </div>
          <Room className="mt-10" />
        </section>

        <Chapter
          id="listen"
          n="01"
          kicker="It actually listens"
          title={<>Every string, <span className="text-amber-400">heard.</span></>}
          body="Not a 'did you click done' tutor. It checks each note of the chord, names the string that's muted, and when it isn't sure it says so instead of marking you wrong."
          cta={{ href: "/practice", label: "Try a chord" }}
        >
          <VerdictDemo />
        </Chapter>

        <Chapter
          id="songs"
          n="02"
          kicker="Learn any song"
          title={<>Name a song. Get the <span className="text-amber-400">chart.</span></>}
          body="Open Strings builds a chord chart bar by bar — transpose it, slap on a capo, simplify the hard chords, autoscroll while you play, and pull up a picking tab for every shape. Then it splits the song into section lessons."
          cta={{ href: "/practice?mode=song", label: "Search a song" }}
        >
          <ChartDemo />
        </Chapter>

        <Chapter
          id="mastery"
          n="03"
          kicker="Progress that sticks"
          title={<>Three clean days. <span className="text-amber-400">Then it&apos;s yours.</span></>}
          body="Your wall fills with gold records as chords stick — and the room brings them back for a quick re-check before they fade."
          cta={{ href: "/progress", label: "See your wall" }}
        >
          <MasteryDemo />
        </Chapter>

        <section id="teachers" className="scroll-mt-20 py-20 sm:py-28" aria-labelledby="teachers-title">
          <Reveal>
            <div className="relative overflow-hidden rounded-[28px] border border-cream/10 bg-[radial-gradient(ellipse_at_top_right,rgba(217,72,59,0.18),transparent_55%)] p-8 sm:p-12">
              <p className="label-mono text-amp-300">For teachers</p>
              <h2 id="teachers-title" className="mt-3 max-w-2xl font-display text-h2 uppercase leading-[0.95] text-cream">
                Run a class from one room.
              </h2>
              <ul className="mt-6 grid gap-3 text-cream/75 sm:grid-cols-3">
                <li className="rounded-2xl border border-cream/10 p-4">Share an invite code — students join in one tap.</li>
                <li className="rounded-2xl border border-cream/10 p-4">Assign chords; they show up first in each student&apos;s plan.</li>
                <li className="rounded-2xl border border-cream/10 p-4">See who&apos;s mastered what, and get an AI progress report per student.</li>
              </ul>
              <Link href="/signup" className="mt-8 inline-flex rounded-full border border-cream/20 px-6 py-3 font-semibold text-cream hover:border-amp-400/60">
                Set up a class
              </Link>
            </div>
          </Reveal>
        </section>

        <section className="py-20 text-center sm:py-28" aria-labelledby="cta-title">
          <Reveal>
            <h2 id="cta-title" className="font-display text-display uppercase text-cream">
              Pick it up.
              <br />
              <span className="text-amber-400">Play it right.</span>
            </h2>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/start" className="rounded-full bg-amber-400 px-7 py-3.5 font-semibold text-ink-950 hover:bg-amber-300">
                Start in 30 seconds
              </Link>
              <Link href="/signup" className="rounded-full border border-cream/20 px-7 py-3.5 font-semibold text-cream hover:border-amber-400/60">
                Create a free account
              </Link>
            </div>
          </Reveal>
        </section>
      </main>
      <Footer />
    </div>
  );
}
