import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Unbounded } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import NativeShell, { NATIVE_BOOT_SCRIPT } from "@/components/native/NativeShell";
import RotateHint from "@/components/native/RotateHint";
import PwaShell from "@/components/native/PwaShell";
import Monitoring from "@/components/native/Monitoring";
import { THEME_BOOT_SCRIPT } from "@/lib/theme";

// Stage Lights type: a wide, bold geometric display face for big statements,
// a crisp text face, and a mono for labels, readouts and tabs.
// All three are variable fonts: one file each covers every weight (listing weights
// fetched ten files). Body and mono use "optional": next/font's size-matched fallback
// shows at once and the real face is used when it's already there, so text never
// repaints (that repaint was the slowest paint on most pages).
const display = Unbounded({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "optional",
  preload: false,
});

const body = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "optional",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://ai-guitar-tutor.vercel.app"),
  title: { default: "Open Strings — the guitar practice room that listens", template: "%s · Open Strings" },
  description: "Play a chord. Open Strings listens to every string and tells you exactly what to fix — then turns any song into a chord chart, tabs and lessons.",
  applicationName: "Open Strings",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icons/favicon-32.png", apple: "/icons/apple-touch-icon.png" },
  // installed on an iPhone / iPad home screen: full screen, dark status bar
  appleWebApp: { capable: true, title: "Open Strings", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
  openGraph: {
    type: "website",
    siteName: "Open Strings",
    title: "Open Strings — the guitar practice room that listens",
    description: "Play a chord and it hears every string. Any chord, any song, lessons from day one to pro.",
    images: [{ url: "/og.jpg", width: 1200, height: 630, alt: "The Open Strings practice room: a guitar, an amp and a record player under stage lights" }],
  },
  twitter: { card: "summary_large_image" },
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
          <PwaShell />
          <Monitoring />
          <RotateHint />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
