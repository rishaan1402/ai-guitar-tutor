import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-white/5 mt-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <span className="text-lg">🎸</span>
            <span className="font-semibold text-white">AI Guitar Tutor</span>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-gray-500">
            <Link href="/practice" className="hover:text-gray-300 transition-colors">Practice</Link>
            <a href="#features" className="hover:text-gray-300 transition-colors">Features</a>
            <a href="#for-teachers" className="hover:text-gray-300 transition-colors">For Teachers</a>
            <Link href="/login" className="hover:text-gray-300 transition-colors">Log In</Link>
            <Link href="/signup" className="hover:text-gray-300 transition-colors">Sign Up</Link>
          </div>
        </div>

        <p className="text-xs text-gray-600 mt-8">
          Built for guitarists who want feedback, not just footage.
        </p>
      </div>
    </footer>
  );
}
