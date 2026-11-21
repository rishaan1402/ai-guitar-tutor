"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isStandalone, startPwa } from "@/lib/pwa";

/** Website only: registers the service worker, listens for the install prompt, and opens the installed app on the studio. */
export default function PwaShell() {
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => startPwa(), []);
  useEffect(() => {
    // opened from the home-screen icon: the app starts in the studio, not the marketing page
    if (pathname === "/" && isStandalone()) router.replace("/studio");
  }, [pathname, router]);
  return null;
}
