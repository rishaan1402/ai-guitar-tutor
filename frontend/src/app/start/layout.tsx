import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Set up in 30 seconds",
  description: "Mic check, tuning and your first chord.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
