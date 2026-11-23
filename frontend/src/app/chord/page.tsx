import type { Metadata } from "next";
import Link from "next/link";
import NavBar from "@/components/NavBar";
import { CATALOG, CATALOG_ROOTS } from "@/lib/chords/catalog";

export const metadata: Metadata = {
  title: "Guitar chords: every common chord, with shapes",
  description: "Major, minor, 7th, sus, add9, diminished and more in all twelve keys: the shape, the notes and how to finger each one.",
};

export default function ChordIndex() {
  return (
    <main className="min-h-screen bg-ink-950">
      <NavBar />
      <div className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
        <p className="label-mono text-amber-300">Chords</p>
        <h1 className="mt-2 font-display text-h1 uppercase text-cream">Guitar chords</h1>
        <p className="mt-3 max-w-2xl text-cream/75">Every common chord in all twelve keys. Open one for its shape, its notes and which finger goes where, then play it into your mic for feedback on every string.</p>
        <div className="mt-8 space-y-6">
          {CATALOG_ROOTS.map((root) => (
            <section key={root} aria-labelledby={`root-${root}`}>
              <h2 id={`root-${root}`} className="font-display text-lg uppercase text-cream">{root}</h2>
              <ul className="mt-2 flex flex-wrap gap-2">
                {CATALOG.filter((c) => c.root === root).map((c) => (
                  <li key={c.slug}>
                    <Link href={`/chord/${c.slug}`} className="inline-block rounded-full border border-cream/15 px-3 py-1.5 text-sm text-cream hover:border-amber-400/50">{c.symbol}</Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
