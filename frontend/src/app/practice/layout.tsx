import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Chords: play any chord, hear every string",
  description: "Type any chord or pick one. Watch it, hear it, play it into your mic, and see exactly which string to fix.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
