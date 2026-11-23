import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Guitar tuner",
  description: "A free guitar tuner in your browser: any string, any order, standard and alternate tunings.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
