import type { MetadataRoute } from "next";
import { CATALOG } from "@/lib/chords/catalog";
import { publicSongs } from "@/lib/publicSongs";

export const dynamic = "force-static";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://ai-guitar-tutor.vercel.app";
const PAGES: [string, number][] = [
  ["/", 1],
  ["/path", 0.9],
  ["/practice", 0.9],
  ["/practice?mode=song", 0.8],
  ["/tuner", 0.8],
  ["/rhythm", 0.6],
  ["/groove", 0.6],
  ["/songs", 0.6],
  ["/studio", 0.6],
  ["/start", 0.5],
  ["/download", 0.4],
  ["/privacy", 0.2],
  ["/terms", 0.2],
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const songs = process.env.MOBILE_BUILD === "1" ? [] : await publicSongs();
  return [
    ...PAGES.map(([path, priority]) => ({ url: `${SITE}${path}`, changeFrequency: "weekly" as const, priority })),
    { url: `${SITE}/chord`, changeFrequency: "monthly" as const, priority: 0.7 },
    ...CATALOG.map((c) => ({ url: `${SITE}/chord/${c.slug}`, changeFrequency: "monthly" as const, priority: 0.6 })),
    ...(songs.length ? [{ url: `${SITE}/song`, changeFrequency: "daily" as const, priority: 0.6 }] : []),
    ...songs.map((s) => ({ url: `${SITE}/song/${s.slug}`, changeFrequency: "weekly" as const, priority: 0.5 })),
  ];
}
