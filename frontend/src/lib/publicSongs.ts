/**
 * Songs with a public page, fetched from the API at build time and refreshed
 * daily (ISR on Vercel). Facts only: key, chords used, sections. Only songs
 * whose chords are trusted are listed (see the API's /songs/public).
 */
export interface PublicSong {
  slug: string;
  song_id: string;
  title: string;
  artist: string;
  key: string;
  time_signature: string;
  difficulty: string;
  tempo_bpm: number | null;
  capo: number;
  strumming: string;
  chords: string[];
  sections: string[];
  techniques: string[];
  corrected: boolean;
}

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function publicSongs(): Promise<PublicSong[]> {
  try {
    const res = await fetch(`${API}/api/council/songs/public`, { next: { revalidate: 86400 } });
    if (!res.ok) return [];
    return ((await res.json()) as { songs: PublicSong[] }).songs;
  } catch {
    return []; // API unreachable at build time: no song pages this build, the rest of the site is fine
  }
}
