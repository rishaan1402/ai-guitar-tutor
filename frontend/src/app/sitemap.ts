import type { MetadataRoute } from "next";

export const dynamic = "force-static";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://ai-guitar-tutor.vercel.app";
const PAGES: [string, number][] = [
  ["/", 1],
  ["/path", 0.9],
  ["/practice", 0.9],
  ["/practice?mode=song", 0.8],
  ["/tuner", 0.8],
  ["/groove", 0.6],
  ["/songs", 0.6],
  ["/studio", 0.6],
  ["/start", 0.5],
  ["/download", 0.4],
  ["/privacy", 0.2],
  ["/terms", 0.2],
];

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.map(([path, priority]) => ({ url: `${SITE}${path}`, changeFrequency: "weekly", priority }));
}
