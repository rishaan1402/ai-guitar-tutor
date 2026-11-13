import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as api from "../api";
import { getAccessToken, getRefreshToken, loginHref, refreshAccessToken, safeNext, setTokens } from "../auth";

type Call = { url: string; method: string; auth: string | null };

let calls: Call[];
const orig = globalThis.fetch;

function mockFetch(handler: (url: string, init: RequestInit) => Response | Promise<Response>) {
  globalThis.fetch = (async (url: string, init: RequestInit = {}) => {
    const h = new Headers(init.headers);
    calls.push({ url, method: init.method ?? "GET", auth: h.get("Authorization") });
    return handler(url, init);
  }) as typeof fetch;
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const wav = () => new Blob([new Uint8Array(10)], { type: "audio/wav" });

beforeEach(() => {
  calls = [];
  localStorage.clear();
  window.history.replaceState(null, "", "/practice?chord=C_major");
});

afterEach(() => {
  globalThis.fetch = orig;
  vi.restoreAllMocks();
});

describe("submitAudio after the session was revoked (P1-D)", () => {
  it("401 → refresh 401 → anonymous retry 200: graded, savedAnonymously, tokens cleared, no redirect", async () => {
    setTokens("bad-access", "bad-refresh");
    const hrefBefore = window.location.href;
    mockFetch((url, init) => {
      if (url.endsWith("/api/auth/refresh")) return json({ detail: "revoked" }, 401);
      const auth = new Headers(init.headers).get("Authorization");
      return auth ? json({ detail: "bad token" }, 401) : json({ verdict: "pass", evaluation: { score: 1 } });
    });
    const res = await api.submitAudio(wav(), "C_major", []);
    expect(res.verdict).toBe("pass");
    expect(res.savedAnonymously).toBe(true);
    expect(calls.map((c) => [c.url.replace(/^https?:\/\/[^/]+/, ""), c.auth])).toEqual([
      ["/submit_audio", "Bearer bad-access"],
      ["/api/auth/refresh", null],
      ["/submit_audio", null],
    ]);
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
    expect(window.location.href).toBe(hrefBefore);
  });

  it("an expired access token with a good refresh token is refreshed transparently (saved, not anonymous)", async () => {
    setTokens("old", "r1");
    mockFetch((url, init) => {
      if (url.endsWith("/api/auth/refresh")) return json({ access_token: "new", refresh_token: "r2" });
      const auth = new Headers(init.headers).get("Authorization");
      return auth === "Bearer new" ? json({ verdict: "fail" }) : json({}, 401);
    });
    const res = await api.submitAudio(wav(), "C_major", []);
    expect(res.verdict).toBe("fail");
    expect(res.savedAnonymously).toBeUndefined();
    expect(getAccessToken()).toBe("new");
  });

  it("a signed-out learner's take is sent once, without auth", async () => {
    mockFetch(() => json({ verdict: "unclear" }));
    const res = await api.submitAudio(wav(), "C_major", []);
    expect(res.verdict).toBe("unclear");
    expect(calls).toHaveLength(1);
    expect(calls[0].auth).toBeNull();
  });
});

describe("refresh single-flight lock", () => {
  it("two parallel 401s → exactly one refresh call", async () => {
    setTokens("old", "r1");
    let refreshes = 0;
    mockFetch(async (url, init) => {
      if (url.endsWith("/api/auth/refresh")) {
        refreshes++;
        await new Promise((r) => setTimeout(r, 5));
        // rotating refresh tokens: a second refresh with r1 would be rejected
        const body = JSON.parse(String(init.body));
        return body.refresh_token === "r1" && refreshes === 1
          ? json({ access_token: "new", refresh_token: "r2" })
          : json({ detail: "revoked" }, 401);
      }
      const auth = new Headers(init.headers).get("Authorization");
      return auth === "Bearer new" ? json({ chords: [], mastered_count: 0, total_attempted: 0, practice_streak: 0 }) : json({}, 401);
    });
    const [a, b] = await Promise.all([api.getProgress(), api.getProgress()]);
    expect(a.practice_streak).toBe(0);
    expect(b.practice_streak).toBe(0);
    expect(refreshes).toBe(1);
    expect(getAccessToken()).toBe("new");
  });

  it("concurrent callers share the same promise and it clears afterwards", async () => {
    setTokens("old", "r1");
    let n = 0;
    mockFetch(() => {
      n++;
      return json({ access_token: `a${n}`, refresh_token: `r${n + 1}` });
    });
    const p1 = refreshAccessToken();
    const p2 = refreshAccessToken();
    expect(p1).toBe(p2);
    expect(await p1).toBe("a1");
    expect(await refreshAccessToken()).toBe("a2"); // a new flight after the first settled
    expect(n).toBe(2);
  });
});

describe("required-auth redirect keeps the page as next=", () => {
  it("a required endpoint whose refresh fails points /login?next= at the current page", async () => {
    setTokens("bad", "bad");
    mockFetch((url) => (url.endsWith("/api/auth/refresh") ? json({}, 401) : json({}, 401)));
    // jsdom can't navigate; check the target we would set
    expect(loginHref()).toBe("/login?next=%2Fpractice%3Fchord%3DC_major");
    await expect(api.getProgress()).rejects.toThrow(/expired/i);
    expect(getAccessToken()).toBeNull();
  });
});

describe("safeNext", () => {
  it("accepts same-site paths only", () => {
    expect(safeNext("/practice?chord=C_major")).toBe("/practice?chord=C_major");
    expect(safeNext("/dashboard")).toBe("/dashboard");
    expect(safeNext("//evil.com")).toBe("/dashboard");
    expect(safeNext("/\\evil.com")).toBe("/dashboard");
    expect(safeNext("https://evil.com/x")).toBe("/dashboard");
    expect(safeNext("javascript:alert(1)")).toBe("/dashboard");
    expect(safeNext("practice")).toBe("/dashboard");
    expect(safeNext("/a\nb")).toBe("/dashboard");
    expect(safeNext("/login?next=/x")).toBe("/dashboard");
    expect(safeNext(null)).toBe("/dashboard");
    expect(safeNext("")).toBe("/dashboard");
  });
});
