import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Your practice room",
  description: "Your guitar practice room: lessons, chords, songs, a tuner and a coach, one tap away.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
