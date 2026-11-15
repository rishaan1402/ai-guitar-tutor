"use client";

import dynamic from "next/dynamic";

// The 3D studio is the app's home screen (three.js loads on this route only).
const Studio3D = dynamic(() => import("@/components/studio3d/Studio3D"), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 flex items-center justify-center bg-ink-950">
      <p className="label-mono animate-pulse text-cream/50">Opening the studio…</p>
    </div>
  ),
});

export default function StudioPage() {
  return <Studio3D />;
}
