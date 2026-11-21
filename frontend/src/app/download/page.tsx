/**
 * INTERIM: test-build download page for the Android app, until it's on Google Play.
 * Unlisted (not in the nav, not indexed). Delete this folder (src/app/download) to remove it,
 * and the APK with: gcloud storage rm gs://guitar-tutor-prod-2-lessons/app/open-strings-debug.apk
 */
import type { Metadata } from "next";
import Link from "next/link";
import Logo from "@/components/brand/Logo";

export const metadata: Metadata = {
  title: "Download the Android app",
  robots: { index: false, follow: false },
};

const APK_URL = "https://storage.googleapis.com/guitar-tutor-prod-2-lessons/app/open-strings-debug.apk";
const BUILD = { version: "3.3.0", code: 16, size: "39 MB", date: "21 Nov 2026" };

const STEPS = [
  "Tap Download for Android above, on your Android phone (about 39 MB).",
  "Open the downloaded file from the notification or your Files / Downloads app.",
  "If Android says the source isn't allowed, tap Settings, turn on “Allow from this source”, then go back.",
  "Tap Install. If Play Protect warns the app is unknown, tap More details → Install anyway (it's a test build, not from the Play Store yet).",
  "Open Open Strings and allow the microphone when you first tune or record.",
];

export default function DownloadPage() {
  return (
    <main className="min-h-screen bg-ink-950 px-4 py-10 sm:py-16">
      <div className="mx-auto max-w-xl">
        <Link href="/" aria-label="Open Strings home">
          <Logo size="md" />
        </Link>

        <p className="label-mono mt-10 text-amber-400">Android · test build</p>
        <h1 className="mt-2 font-display text-h1 uppercase text-cream">Get the app</h1>
        <p className="mt-3 text-cream/70">
          The practice room on your phone: every lesson built in, so they open instantly and work offline.
          Your progress syncs with the website.
        </p>

        <a
          href={APK_URL}
          download="open-strings.apk"
          className="mt-8 flex items-center justify-between gap-4 rounded-[22px] bg-amber-400 px-6 py-5 text-ink-950 transition hover:bg-amber-300"
        >
          <span>
            <span className="block font-display text-xl">Download for Android</span>
            <span className="mt-1 block text-sm text-ink-950/70">
              Version {BUILD.version} (build {BUILD.code}) · {BUILD.size} · {BUILD.date}
            </span>
          </span>
          <span aria-hidden="true" className="text-3xl">↓</span>
        </a>
        <p className="mt-3 text-sm text-cream/50">
          On a computer? Open this page on your phone instead, or copy the file to your phone after downloading.
        </p>

        <h2 className="mt-12 font-display text-xl text-cream">How to install</h2>
        <ol className="mt-4 space-y-3">
          {STEPS.map((s, i) => (
            <li key={i} className="flex gap-3 text-cream/80">
              <span className="label-mono mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-cream/20 text-cream/60">
                {i + 1}
              </span>
              <span>{s}</span>
            </li>
          ))}
        </ol>

        <div className="mt-10 rounded-2xl border border-cream/10 p-5 text-sm text-cream/60">
          <p className="font-semibold text-cream/80">Good to know</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Sign in with your email and password; Google sign-in inside the app is coming.</li>
            <li>To update, install a newer download over the top: nothing is lost.</li>
            <li>iPhone: use this website in Safari for now (Share → Add to Home Screen).</li>
          </ul>
        </div>

        <p className="mt-8 text-sm text-cream/40">
          <Link href="/privacy" className="hover:text-cream">Privacy policy</Link>
          {" · "}
          <Link href="/" className="hover:text-cream">Back to the website</Link>
        </p>
      </div>
    </main>
  );
}
