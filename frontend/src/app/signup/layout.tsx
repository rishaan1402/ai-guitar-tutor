import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create an account",
  description: "Free account: keep your progress on every device.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
