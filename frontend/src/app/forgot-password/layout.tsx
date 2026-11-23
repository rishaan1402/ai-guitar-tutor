import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reset your password",
  description: "Reset your Open Strings password.",
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
