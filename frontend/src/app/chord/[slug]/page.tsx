import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import NavBar from "@/components/NavBar";
import ChordDiagram from "@/components/ChordDiagram";
import type { FretPosition } from "@/lib/api";
import { CATALOG, CATALOG_QUALITIES, CATALOG_ROOTS, chordBySlug, chordSlug, formula } from "@/lib/chords/catalog";
import { describe, parseSymbol } from "@/lib/chords/quality";
import { buildFingering } from "@/lib/chords/voicing";

/** One public page per common chord: shape, notes, how to finger it, and a way to play it for the app. */
export const dynamicParams = false;

export function generateStaticParams() {
  return CATALOG.map((c) => ({ slug: c.slug }));
}

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://ai-guitar-tutor.vercel.app";
const STRING_NAMES: Record<number, string> = { 6: "low E", 5: "A", 4: "D", 3: "G", 2: "B", 1: "high E" };
const FINGERS: Record<number, string> = { 1: "index", 2: "middle", 3: "ring", 4: "little" };
const ordinal = (n: number) => `${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"}`;

function load(slug: string) {
  const c = chordBySlug(slug);
  const spec = c && parseSymbol(c.symbol);
  const fingering = c && buildFingering(c.symbol);
  return c && spec && fingering ? { c, spec, fingering } : null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const data = load((await params).slug);
  if (!data) return {};
  const { c, spec } = data;
  return {
    title: `${c.symbol} chord on guitar`,
    description: `How to play ${c.symbol} (${describe(spec)}) on guitar: the shape, which finger goes where, the notes ${spec.noteNames.join(" ")}. Play it into your mic and hear every string.`,
    alternates: { canonical: `${SITE}/chord/${c.slug}` },
  };
}

function steps(positions: FretPosition[]): string[] {
  return positions
    .slice()
    .sort((a, b) => b.string - a.string)
    .map((p) => {
      const s = `${ordinal(p.string)} string (${STRING_NAMES[p.string]})`;
      if (p.action === "mute" || p.fret === undefined) return `${s}: don't play it`;
      if (p.fret === 0) return `${s}: open${p.note ? `, ${p.note}` : ""}`;
      return `${s}: ${ordinal(p.fret)} fret${p.finger ? ` with your ${FINGERS[p.finger]} finger` : ""}${p.note ? `, ${p.note}` : ""}`;
    });
}

export default async function ChordPage({ params }: { params: Promise<{ slug: string }> }) {
  const data = load((await params).slug);
  if (!data) notFound();
  const { c, spec, fingering } = data;
  const sameRoot = CATALOG_QUALITIES.filter((q) => q !== c.quality).map((q) => ({ symbol: c.root + q, slug: chordSlug(c.root, q) }));
  const sameType = CATALOG_ROOTS.filter((r) => r !== c.root).map((r) => ({ symbol: r + c.quality, slug: chordSlug(r, c.quality) }));
  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Chords", item: `${SITE}/chord` },
      { "@type": "ListItem", position: 2, name: `${c.symbol} chord`, item: `${SITE}/chord/${c.slug}` },
    ],
  };

  return (
    <main className="min-h-screen bg-ink-950">
      <NavBar />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }} />
      <article className="mx-auto max-w-4xl px-4 py-8 sm:py-12">
        <nav aria-label="Breadcrumb" className="label-mono text-cream/60">
          <Link href="/chord" className="hover:text-cream">Chords</Link> <span aria-hidden="true">›</span> {c.symbol}
        </nav>
        <h1 className="mt-3 font-display text-h1 uppercase text-cream">{c.symbol} chord</h1>
        <p className="mt-2 text-lg text-cream/75">{describe(spec)} · notes {spec.noteNames.join(" ")} · formula {formula(spec)}</p>

        <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-[260px_1fr]">
          <div className="self-start rounded-[26px] border border-cream/10 bg-ink-900/60 p-4">
            <ChordDiagram fingering={fingering} caption={c.symbol} />
          </div>
          <div className="space-y-5">
            <section aria-labelledby="how-h">
              <h2 id="how-h" className="font-display text-xl uppercase text-cream">How to play it</h2>
              <ol className="mt-3 space-y-1.5 text-cream/80">
                {steps(fingering.positions).map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
            </section>
            {fingering.alt_positions && (
              <section aria-labelledby="alt-h">
                <h2 id="alt-h" className="font-display text-lg uppercase text-cream">Further up the neck</h2>
                <ol className="mt-2 space-y-1 text-sm text-cream/70">
                  {steps(fingering.alt_positions).map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ol>
              </section>
            )}
            <div className="rounded-2xl border border-amber-400/40 bg-amber-400/10 p-4">
              <p className="font-semibold text-cream">Not sure you&apos;re playing it right?</p>
              <p className="mt-1 text-sm text-cream/75">Play {c.symbol} into your mic: Open Strings hears every string and tells you which one to fix.</p>
              <Link href={`/chords/learn?c=${encodeURIComponent(c.symbol)}`} className="mt-3 inline-flex rounded-full bg-amber-400 px-5 py-2.5 font-semibold text-ink-950">
                Play {c.symbol} and get feedback
              </Link>
            </div>
          </div>
        </div>

        <section aria-labelledby="root-h" className="mt-10">
          <h2 id="root-h" className="font-display text-lg uppercase text-cream">Other {c.root} chords</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {sameRoot.map((o) => (
              <li key={o.slug}><Link href={`/chord/${o.slug}`} className="inline-block rounded-full border border-cream/15 px-3 py-1.5 text-sm text-cream hover:border-amber-400/50">{o.symbol}</Link></li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="type-h" className="mt-6">
          <h2 id="type-h" className="font-display text-lg uppercase text-cream">{spec.quality.name} in every key</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {sameType.map((o) => (
              <li key={o.slug}><Link href={`/chord/${o.slug}`} className="inline-block rounded-full border border-cream/15 px-3 py-1.5 text-sm text-cream hover:border-amber-400/50">{o.symbol}</Link></li>
            ))}
          </ul>
        </section>
      </article>
    </main>
  );
}
