/**
 * Token storage and refresh helpers.
 * Tokens are stored in localStorage (access + refresh).
 */

const ACCESS_TOKEN_KEY = "guitar_tutor_access_token";
const REFRESH_TOKEN_KEY = "guitar_tutor_refresh_token";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(accessToken: string, refreshToken: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearTokens(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

let inflight: Promise<string | null> | null = null;

/**
 * Exchange the stored refresh token for a new access token.
 * Returns the new access token on success, or null if refresh fails.
 * On failure, clears all tokens (forces re-login).
 *
 * Single-flight: refresh tokens rotate (the old one is revoked), so parallel
 * 401s must share one refresh, or the second would fail and log the user out.
 */
export function refreshAccessToken(): Promise<string | null> {
  if (inflight) return inflight;
  inflight = doRefresh().finally(() => {
    inflight = null;
  });
  return inflight;
}

async function doRefresh(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  try {
    const res = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!res.ok) {
      clearTokens();
      return null;
    }

    const data = await res.json();
    setTokens(data.access_token, data.refresh_token);
    return data.access_token;
  } catch {
    clearTokens();
    return null;
  }
}

/**
 * A `next=` target from the query string, accepted only if it is a same-site
 * path ("/practice?chord=C_major"); anything else ("//evil.com", "https://…",
 * "/\\evil") falls back to the dashboard.
 */
export function safeNext(next: string | null | undefined, fallback = "/dashboard"): string {
  if (!next || typeof next !== "string") return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f\\]/.test(next)) return fallback;
  if (/^\/login(?:[/?#]|$)/.test(next)) return fallback;
  return next;
}

/** "/login?next=<current path>" for the page we're on. */
export function loginHref(path?: string): string {
  const here =
    path ?? (typeof window !== "undefined" ? window.location.pathname + window.location.search : "/dashboard");
  return `/login?next=${encodeURIComponent(safeNext(here))}`;
}
