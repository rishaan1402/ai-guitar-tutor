import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Grooves: play along with a band",
  description: "Backing bands that wait for your chord changes, built around what you're practising.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
