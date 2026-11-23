import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Strum trainer",
  description: "Practise any strumming pattern with a click. The mic hears each strum and shows which hits were early, late or missed, then nudges the tempo up.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
