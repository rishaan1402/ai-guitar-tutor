import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import NavBar from "@/components/NavBar";
import { chordPageHref } from "@/lib/chords/catalog";
import { publicSongs } from "@/lib/publicSongs";

/**
 * Website only (page.web.tsx: the app's static build leaves it out). One page
 * per song people learned with trusted chords: facts about the song and a way
 * into the lesson. No lyrics and no full chart.
 */
export const revalidate = 86400;
export const dynamicParams = true;

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://ai-guitar-tutor.vercel.app";

export async function generateStaticParams() {
  return (await publicSongs()).map((s) => ({ slug: s.slug }));
}

async function find(slug: string) {
  return (await publicSongs()).find((s) => s.slug === slug) ?? null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const s = await find((await params).slug);
  if (!s) return {};
  const chords = s.chords.slice(0, 6).join(", ");
  return {
    title: `${s.title} by ${s.artist}: chords and guitar lesson`,
    description: `Learn ${s.title} by ${s.artist} on guitar: key of ${s.key}, chords ${chords}${s.capo ? `, capo ${s.capo}` : ""}. A lesson for each section, and the app listens as you play.`,
    alternates: { canonical: `${SITE}/song/${s.slug}` },
  };
}

export default async function SongPage({ params }: { params: Promise<{ slug: string }> }) {
  const s = await find((await params).slug);
  if (!s) notFound();
  const learn = `/practice?mode=song&q=${encodeURIComponent(`${s.title} by ${s.artist}`)}`;
  const facts: [string, string][] = [
    ["Key", s.key],
    ["Time", s.time_signature],
    ["Difficulty", s.difficulty],
    ...(s.tempo_bpm ? [["Tempo", `about ${s.tempo_bpm} bpm`] as [string, string]] : []),
    ...(s.capo ? [["Capo", `${s.capo}${s.capo === 1 ? "st" : s.capo === 2 ? "nd" : s.capo === 3 ? "rd" : "th"} fret`] as [string, string]] : []),
    ...(s.strumming ? [["Strum", s.strumming] as [string, string]] : []),
  ].filter(([, v]) => v) as [string, string][];

  return (
    <main className="min-h-screen bg-ink-950">
      <NavBar />
      <article className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
        <nav aria-label="Breadcrumb" className="label-mono text-cream/60">
          <Link href="/song" className="hover:text-cream">Songs</Link> <span aria-hidden="true">›</span> {s.title}
        </nav>
        <h1 className="mt-3 font-display text-h1 uppercase text-cream">{s.title}</h1>
        <p className="mt-1 text-lg text-cream/75">{s.artist}</p>

        <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {facts.map(([k, v]) => (
            <div key={k} className="rounded-2xl border border-cream/10 bg-ink-900/60 p-3">
              <dt className="label-mono text-[10px] text-amber-300">{k}</dt>
              <dd className="mt-1 capitalize text-cream">{v}</dd>
            </div>
          ))}
        </dl>

        <section aria-labelledby="chords-h" className="mt-8">
          <h2 id="chords-h" className="font-display text-xl uppercase text-cream">Chords in this song</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {s.chords.map((c) => {
              const href = chordPageHref(c);
              return (
                <li key={c}>
                  {href ? (
                    <Link href={href} className="inline-block rounded-full border border-cream/15 px-4 py-2 font-semibold text-cream hover:border-amber-400/50">{c}</Link>
                  ) : (
                    <span className="inline-block rounded-full border border-cream/15 px-4 py-2 font-semibold text-cream">{c}</span>
                  )}
                </li>
              );
            })}
          </ul>
          {s.sections.length > 0 && <p className="mt-4 text-sm text-cream/70">Sections: {s.sections.join(" · ")}</p>}
          <p className="mt-2 text-xs text-cream/60">{s.corrected ? "Chords checked by a person." : "The widely taught version; small differences from the recording are possible."}</p>
        </section>

        <div className="mt-8 rounded-[26px] border border-amber-400/40 bg-amber-400/10 p-5">
          <p className="font-display text-lg uppercase text-cream">Learn it with your guitar</p>
          <p className="mt-1 text-cream/75">The chart, a lesson for each section, the strum and a play-along with a band. Open Strings listens as you play and tells you which string to fix.</p>
          <Link href={learn} className="mt-4 inline-flex rounded-full bg-amber-400 px-5 py-2.5 font-semibold text-ink-950">Learn {s.title}</Link>
        </div>
      </article>
    </main>
  );
}
