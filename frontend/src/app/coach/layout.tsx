import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Your guitar coach",
  description: "Ask about your playing, set a goal and get a weekly plan.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
