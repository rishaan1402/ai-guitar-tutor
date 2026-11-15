import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, H2 } from "@/components/legal/LegalPage";
import { SITE, contactLine } from "@/lib/site";

export const metadata: Metadata = { title: `Terms · ${SITE.name}` };

export default function TermsPage() {
  return (
    <LegalPage kicker="Terms" title="Terms of use">
      <p>
        These terms cover your use of {SITE.name} on the web and in the app. By using it you agree to them. Our{" "}
        <Link href="/privacy" className="text-amber-300 underline underline-offset-4">privacy policy</Link> explains
        what data we handle.
      </p>

      <H2>Who can use it</H2>
      <p>You need to be at least {SITE.minimumAge}. You&apos;re responsible for keeping your password private.</p>

      <H2>What you can expect</H2>
      <p>
        {SITE.name} listens to your playing and gives feedback. Grading is automatic and can be wrong — a noisy room,
        an unusual guitar or microphone can confuse it. AI-written feedback and song charts can contain mistakes; use
        the <em>Report</em> link when they do. The service is provided as it is, and may change or be unavailable at
        times.
      </p>

      <H2>Your content</H2>
      <p>
        Song sheets you write stay yours. You give us permission to store and show them to you (and to your teacher,
        if you share with a class) so the service can work. Don&apos;t upload things you don&apos;t have the right to
        share, and don&apos;t put song lyrics you don&apos;t own into shared sheets.
      </p>

      <H2>Fair use</H2>
      <p>
        Don&apos;t misuse the service: no attempts to break in, overload it, scrape it, or use it to harass anyone.
        We may limit or close accounts that do.
      </p>

      <H2>Ending</H2>
      <p>
        You can stop at any time and{" "}
        <Link href="/delete-account" className="text-amber-300 underline underline-offset-4">delete your account</Link>.
      </p>

      <H2>Liability</H2>
      <p>
        To the extent the law allows, we aren&apos;t liable for indirect losses from using {SITE.name}. Nothing here
        limits rights you have under consumer law where you live.
      </p>

      <H2>Contact</H2>
      <p>Questions about these terms: {contactLine()}.</p>
    </LegalPage>
  );
}
