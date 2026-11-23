import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing: Open Strings is free",
  description: "Everything in Open Strings is free while we build it. Pro is coming: unlimited song lessons, a coach that remembers you, and more.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
