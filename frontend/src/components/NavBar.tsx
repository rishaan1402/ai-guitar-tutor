"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-red-100 text-red-800",
  teacher: "bg-blue-100 text-blue-800",
  student: "bg-green-100 text-green-800",
};

export default function NavBar() {
  const { user, loading, logout, isTeacher, isAdmin } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

  return (
    <nav className="w-full bg-gray-900 border-b border-gray-700 px-4 py-2 flex items-center justify-between">
      <Link href="/" className="text-white font-semibold text-lg tracking-tight">
        🎸 AI Guitar Tutor
      </Link>

      <div className="flex items-center gap-3">
        {loading ? (
          <span className="text-gray-400 text-sm">Loading…</span>
        ) : user ? (
          <>
            {isAdmin && (
              <Link
                href="/admin"
                className="text-sm text-red-300 hover:text-red-100 transition-colors"
              >
                Admin
              </Link>
            )}
            {isTeacher && (
              <Link
                href="/teacher"
                className="text-sm text-blue-300 hover:text-blue-100 transition-colors"
              >
                Dashboard
              </Link>
            )}
            <Link
              href="/profile"
              className="text-sm text-gray-300 hover:text-white transition-colors"
            >
              {user.display_name}
            </Link>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                ROLE_COLORS[user.role] ?? "bg-gray-100 text-gray-800"
              }`}
            >
              {user.role}
            </span>
            <button
              onClick={handleLogout}
              className="text-sm text-gray-400 hover:text-white transition-colors ml-1"
            >
              Logout
            </button>
          </>
        ) : (
          <>
            <Link
              href="/login"
              className="text-sm text-gray-300 hover:text-white transition-colors"
            >
              Log In
            </Link>
            <Link
              href="/signup"
              className="text-sm bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1 rounded-md transition-colors"
            >
              Sign Up
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
