import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import * as api from "../api";

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return f === "__tests__" ? [] : sources(p);
    return /\.(ts|tsx)$/.test(f) ? [p] : [];
  });
}

describe("legacy session endpoints are gone from the frontend", () => {
  it("api.ts no longer exports learnChord / getSession / resetSession", () => {
    const mod = api as Record<string, unknown>;
    expect(mod.learnChord).toBeUndefined();
    expect(mod.getSession).toBeUndefined();
    expect(mod.resetSession).toBeUndefined();
    expect(typeof mod.getLesson).toBe("function");
  });

  it("no source calls /learn_chord, /session, /reset or sends X-Session-Id", () => {
    const root = join(__dirname, "..", "..");
    const offenders = sources(root).filter((p) => {
      const s = readFileSync(p, "utf8");
      return /["'`]\/learn_chord|["'`]\/session["'`]|["'`]\/reset["'`]|X-Session-Id|learnChord\(|resetSession\(/.test(s);
    });
    expect(offenders).toEqual([]);
  });

  it("submitAudio always sends chord_name and graded previous_scores", async () => {
    const calls: { url: string; body: FormData; headers: Headers }[] = [];
    const orig = globalThis.fetch;
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      calls.push({ url, body: init.body as FormData, headers: new Headers(init.headers) });
      return new Response(JSON.stringify({ verdict: "pass" }), { status: 200 });
    }) as typeof fetch;
    try {
      await api.submitAudio(new Blob([new Uint8Array(10)], { type: "audio/wav" }), "C_major", [0.67]);
    } finally {
      globalThis.fetch = orig;
    }
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toMatch(/\/submit_audio$/);
    expect(calls[0].body.get("chord_name")).toBe("C_major");
    expect(calls[0].body.get("previous_scores")).toBe("[0.67]");
    expect(calls[0].headers.has("X-Session-Id")).toBe(false);
  });
});
