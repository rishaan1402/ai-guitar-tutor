import type { Metadata } from "next";
import Link from "next/link";
import NavBar from "@/components/NavBar";
import { publicSongs } from "@/lib/publicSongs";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Songs to learn on guitar",
  description: "Songs learners are playing on Open Strings: key, chords and a lesson for each section.",
};

export default async function SongIndex() {
  const songs = await publicSongs();
  return (
    <main className="min-h-screen bg-ink-950">
      <NavBar />
      <div className="mx-auto max-w-4xl px-4 py-8 sm:py-12">
        <p className="label-mono text-amber-300">Songs</p>
        <h1 className="mt-2 font-display text-h1 uppercase text-cream">Songs to learn</h1>
        <p className="mt-3 max-w-2xl text-cream/75">Songs learners are playing, with their key and chords. Not here? <Link href="/practice?mode=song" className="text-amber-300 underline underline-offset-4">Name any song</Link> and get a lesson for it.</p>
        <ul className="mt-8 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {songs.map((s) => (
            <li key={s.slug}>
              <Link href={`/song/${s.slug}`} className="block rounded-2xl border border-cream/10 p-4 hover:border-amber-400/40">
                <span className="block font-semibold text-cream">{s.title}</span>
                <span className="block text-sm text-cream/70">{s.artist} · {s.key} · {s.chords.slice(0, 5).join(" ")}</span>
              </Link>
            </li>
          ))}
        </ul>
        {songs.length === 0 && <p className="mt-8 text-cream/70">No songs yet.</p>}
      </div>
    </main>
  );
}
