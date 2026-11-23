import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, H2 } from "@/components/legal/LegalPage";
import { SITE, contactLine } from "@/lib/site";

export const metadata: Metadata = { title: "Delete your account" };

/** Public page for Google Play's account-deletion requirement (linked from the store listing). */
export default function DeleteAccountPage() {
  return (
    <LegalPage kicker="Your data" title="Delete your account">
      <p>You can delete your {SITE.name} account yourself at any time, in the app or on the website.</p>

      <H2>In the app or on the website</H2>
      <ol className="list-decimal space-y-2 pl-5">
        <li>
          <Link href="/login?next=/profile" className="text-amber-300 underline underline-offset-4">Log in</Link>.
        </li>
        <li>Open <strong className="text-cream">Profile</strong> (tap your name at the top).</li>
        <li>Scroll to <strong className="text-cream">Delete account</strong>, enter your password and confirm.</li>
      </ol>

      <H2>What gets deleted</H2>
      <p>
        Straight away and permanently: your account (email, name, password), every graded take and score, chord-change
        and quiz results, saved song sheets, class memberships and teacher assignments, and any sign-in sessions.
        Recordings aren&apos;t stored in the first place — each one is deleted as soon as it&apos;s graded.
      </p>

      <H2>Can&apos;t log in?</H2>
      <p>
        Reset your password from the{" "}
        <Link href="/forgot-password" className="text-amber-300 underline underline-offset-4">log-in page</Link>, or{" "}
        {contactLine()} from the address on the account and we&apos;ll delete it for you.
      </p>
    </LegalPage>
  );
}
