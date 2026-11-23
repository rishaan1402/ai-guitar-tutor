import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Learn any chord",
  description: "Any chord name, from C to F#m7b5: a playable shape, an animated lesson and feedback on every string.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
