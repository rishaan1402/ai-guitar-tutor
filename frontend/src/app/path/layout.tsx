import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Guitar lessons, beginner to pro",
  description: "Four tracks of short guitar lessons, from your first chord to barre chords, lead, theory and fingerstyle. The app listens as you play.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
