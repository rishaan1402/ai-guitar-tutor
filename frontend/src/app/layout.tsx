import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Unbounded } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import NativeShell, { NATIVE_BOOT_SCRIPT } from "@/components/native/NativeShell";
import RotateHint from "@/components/native/RotateHint";
import { THEME_BOOT_SCRIPT } from "@/lib/theme";

// Stage Lights type: a wide, bold geometric display face for big statements,
// a crisp text face, and a mono for labels, readouts and tabs.
const display = Unbounded({
  subsets: ["latin"],
  weight: ["500", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-mono",
  display: "swap",
});

const body = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Open Strings — the guitar practice room that listens", template: "%s · Open Strings" },
  description: "Play a chord. Open Strings listens to every string and tells you exactly what to fix — then turns any song into a chord chart, tabs and lessons.",
};

export const viewport: Viewport = {
  themeColor: "#0c0a09",
  // draw edge to edge (behind a phone's camera cutout); pages pad with the safe-area insets
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${display.variable} ${mono.variable} ${body.variable}`}>
      <head>
        {/* Android app only: carry a deep path across a full reload (no-op in browsers) */}
        <script dangerouslySetInnerHTML={{ __html: NATIVE_BOOT_SCRIPT }} />
        {/* the saved theme, before the first paint */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="font-sans">
        <AuthProvider>
          <NativeShell />
          <RotateHint />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
