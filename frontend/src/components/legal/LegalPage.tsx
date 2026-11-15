import type { ReactNode } from "react";
import Link from "next/link";
import Logo from "@/components/brand/Logo";
import { SITE } from "@/lib/site";

/** Plain, readable layout for the privacy policy, terms and account-deletion pages. */
export function LegalPage({ kicker, title, children }: { kicker: string; title: string; children: ReactNode }) {
  return (
    <main className="min-h-screen bg-ink-950 px-4 py-10 sm:py-16">
      <div className="mx-auto max-w-2xl">
        <Link href="/" aria-label={`${SITE.name} home`}>
          <Logo size="md" />
        </Link>
        <p className="label-mono mt-10 text-amber-400">{kicker}</p>
        <h1 className="mt-2 font-display text-h1 uppercase text-cream">{title}</h1>
        <p className="mt-2 text-sm text-cream/50">Last updated {SITE.legalUpdated}</p>
        <div className="legal mt-8 space-y-6 text-[15px] leading-relaxed text-cream/80">{children}</div>
        <nav className="mt-12 flex flex-wrap gap-x-6 gap-y-2 border-t border-cream/10 pt-6 text-sm text-cream/50">
          <Link href="/privacy" className="hover:text-cream">Privacy policy</Link>
          <Link href="/terms" className="hover:text-cream">Terms</Link>
          <Link href="/delete-account" className="hover:text-cream">Delete your account</Link>
          <Link href="/" className="hover:text-cream">Home</Link>
        </nav>
      </div>
    </main>
  );
}

export function H2({ children }: { children: ReactNode }) {
  return <h2 className="pt-2 font-display text-xl text-cream">{children}</h2>;
}
