import Link from "next/link";
import Logo from "@/components/brand/Logo";

export function Footer() {
  return (
    <footer className="mt-24 border-t border-cream/5">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <Logo size="md" />
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-cream/50">
            <Link href="/start" className="hover:text-cream">Start</Link>
            <Link href="/practice" className="hover:text-cream">Practice</Link>
            <Link href="/practice?mode=song" className="hover:text-cream">Learn a song</Link>
            <Link href="/songs" className="hover:text-cream">Songs</Link>
            <Link href="/login" className="hover:text-cream">Log in</Link>
            <Link href="/signup" className="hover:text-cream">Sign up</Link>
          </div>
        </div>
        <p className="label-mono mt-8 text-cream/30">E · A · D · G · B · e — start anywhere.</p>
      </div>
    </footer>
  );
}
