import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, H2 } from "@/components/legal/LegalPage";
import { SITE, contactLine } from "@/lib/site";

export const metadata: Metadata = { title: "Privacy policy" };

export default function PrivacyPage() {
  return (
    <LegalPage kicker="Privacy" title="Privacy policy">
      <p>
        {SITE.name} teaches guitar: you play a chord into your microphone and we tell you how it sounded.
        This page says exactly what we collect to do that, why, who else handles it, and how to delete it.
      </p>

      <H2>What we collect</H2>
      <ul className="list-disc space-y-2 pl-5">
        <li>
          <strong className="text-cream">Account details</strong> — your email address, the display name you choose,
          and a hashed password (we never store or see the password itself).
        </li>
        <li>
          <strong className="text-cream">Recordings of your playing</strong> — when you press Record, a few seconds of
          audio are sent to our server, graded, and <strong className="text-cream">deleted immediately after grading</strong>.
          We don&apos;t keep recordings and we don&apos;t listen to them. Nothing is recorded until you press Record (or
          strum while the recorder is armed).
        </li>
        <li>
          <strong className="text-cream">Practice history</strong> — which chords you played, their scores, the feedback
          you got, chord-change counts, quiz results, your streak, and song sheets you save. This is what powers your
          progress page and daily plan.
        </li>
        <li>
          <strong className="text-cream">Class membership</strong> — if you join a teacher&apos;s class, that teacher can
          see your practice history and assign you chords.
        </li>
        <li>
          <strong className="text-cream">Basic server logs</strong> — IP address and request times, used to keep the
          service running and to stop abuse (rate limits). Logs are kept for a limited time by our hosting provider.
        </li>
      </ul>
      <p>
        You can use most of {SITE.name} without an account; then your progress stays on your device and only the
        recordings you grade are sent to us (and deleted, as above).
      </p>

      <H2>What we don&apos;t do</H2>
      <ul className="list-disc space-y-2 pl-5">
        <li>No ads, and no advertising or tracking SDKs.</li>
        <li>We don&apos;t sell or rent your data, or share it for anyone&apos;s marketing.</li>
        <li>We don&apos;t read your contacts, location, photos or files.</li>
      </ul>

      <H2>Who else handles your data</H2>
      <p>We use a few service providers, only for running {SITE.name}:</p>
      <ul className="list-disc space-y-2 pl-5">
        <li><strong className="text-cream">Google Cloud</strong> — hosts our server, database and lesson videos (United States).</li>
        <li>
          <strong className="text-cream">Groq</strong> — an AI model writes some of the feedback text and the song charts.
          It receives your scores and chord-level practice stats, or the song name you asked for — never your email,
          name or recordings.
        </li>
        <li>
          <strong className="text-cream">Vercel</strong> — hosts the website, and counts page views on it (Vercel Web
          Analytics: no cookies, no tracking across sites, nothing tied to your account).
        </li>
        <li>
          <strong className="text-cream">Sentry</strong> — receives error reports when something in the app or on our
          server breaks: what failed, the page, your browser or device type. Not your email, name, recordings or
          anything you typed.
        </li>
        <li><strong className="text-cream">Resend</strong> — sends password-reset emails to your address.</li>
        <li>
          <strong className="text-cream">Pro interest</strong> — if you tell us on the pricing page that you&apos;d want Pro,
          we keep which price you saw and, if you give it, your email, only to tell you when Pro is ready. Ask us and we delete it;
          deleting your account deletes it too.
        </li>
      </ul>
      <p>
        AI-written text can be wrong. Every AI response has a <em>Report</em> link; reports include the text you
        flagged so we can fix it.
      </p>

      <H2>How it&apos;s protected</H2>
      <p>
        All traffic is encrypted (HTTPS). Passwords are stored as salted hashes. Access to the database is limited to
        the service itself.
      </p>

      <H2>Keeping and deleting your data</H2>
      <p>
        We keep your account and practice history until you delete your account. Deleting it removes your account and
        all of its practice history, saved songs and class memberships straight away. You can do this in the app under{" "}
        <strong className="text-cream">Profile → Delete account</strong>; see{" "}
        <Link href="/delete-account" className="text-amber-300 underline underline-offset-4">how to delete your account</Link>.
        You can also ask us for a copy of your data or to correct it — {contactLine()}.
      </p>

      <H2>Children</H2>
      <p>
        {SITE.name} is for people aged {SITE.minimumAge} and over. We don&apos;t knowingly collect data from younger
        children; if you think a child under {SITE.minimumAge} has an account, {contactLine()} and we&apos;ll delete it.
      </p>

      <H2>Microphone permission</H2>
      <p>
        The app asks for the microphone only to hear your guitar: for the tuner, for the live string view while you
        play, and for the takes you choose to grade. Tuner and live-view audio never leave your device.
      </p>

      <H2>Changes</H2>
      <p>
        If this policy changes we&apos;ll update the date above, and tell you in the app if the change matters to how
        your data is used.
      </p>

      <H2>Contact</H2>
      <p>For any privacy question or request, {contactLine()}.</p>
    </LegalPage>
  );
}
