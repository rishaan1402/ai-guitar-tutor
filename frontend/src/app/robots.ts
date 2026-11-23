import type { MetadataRoute } from "next";

export const dynamic = "force-static";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://ai-guitar-tutor.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/teacher", "/dashboard", "/profile", "/progress", "/reset-password"] },
    sitemap: `${SITE}/sitemap.xml`,
  };
}
