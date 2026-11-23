import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Chord sheets",
  description: "Chord charts and tabs with transpose, capo, simplify and autoscroll.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
