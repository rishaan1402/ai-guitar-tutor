import type { Metadata, Viewport } from "next";
import { Archivo_Black, IBM_Plex_Mono, Manrope } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import NativeShell, { NATIVE_BOOT_SCRIPT } from "@/components/native/NativeShell";
import RotateHint from "@/components/native/RotateHint";

// Display: heavy grotesk for big statements. Mono: labels, readouts, tabs.
// Body: open, airy sans.
const display = Archivo_Black({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-display",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

const body = Manrope({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
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
    <html lang="en" className={`${display.variable} ${mono.variable} ${body.variable}`}>
      <head>
        {/* Android app only: carry a deep path across a full reload (no-op in browsers) */}
        <script dangerouslySetInnerHTML={{ __html: NATIVE_BOOT_SCRIPT }} />
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
