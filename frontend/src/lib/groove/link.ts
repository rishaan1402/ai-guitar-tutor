/**
 * A Groove travels in its URL (/groove?g=...) so AI Grooves, song sections and
 * "Fix it" loops survive reloads, back, and sharing without a server round trip.
 */
import type { Groove, GrooveStyle } from "./groove";
import { chordNotes } from "./theory";

const STYLES: GrooveStyle[] = ["pop", "ballad", "rock", "folk"];

function b64url(s: string): string {
  const b = typeof btoa === "function" ? btoa(unescape(encodeURIComponent(s))) : Buffer.from(s, "utf8").toString("base64");
  return b.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function unb64url(s: string): string {
  const b = s.replace(/-/g, "+").replace(/_/g, "/");
  return typeof atob === "function" ? decodeURIComponent(escape(atob(b))) : Buffer.from(b, "base64").toString("utf8");
}

export interface GrooveWithSource extends Groove {
  source?: string;
  /** Mode to start in (songs default to follow). */
  mode?: "wait" | "play" | "follow";
}

export function encodeGroove(g: GrooveWithSource): string {
  const { id, title, style, bpm, bars, strum, focus, tip, loops, source, mode } = g;
  return b64url(JSON.stringify({ id, title, style, bpm, bars, strum, focus, tip, loops, source, mode }));
}

export function grooveHref(g: GrooveWithSource): string {
  return `/groove?g=${encodeGroove(g)}`;
}

/** Parse and sanity-check a Groove from a URL; null if anything is off. */
export function decodeGroove(s: string | null | undefined): GrooveWithSource | null {
  if (!s || s.length > 6000) return null;
  try {
    const raw = JSON.parse(unb64url(s));
    const bars: string[][] = Array.isArray(raw.bars) ? raw.bars : [];
    if (!bars.length || bars.length > 64) return null;
    for (const bar of bars) {
      if (!Array.isArray(bar) || bar.length < 1 || bar.length > 2) return null;
      if (bar.some((c: unknown) => typeof c !== "string" || !chordNotes(c))) return null;
    }
    const bpm = Math.round(Number(raw.bpm));
    if (!(bpm >= 40 && bpm <= 200)) return null;
    const strum = String(raw.strum ?? "").toUpperCase();
    const focus = Array.isArray(raw.focus) && raw.focus.length === 2 ? ([String(raw.focus[0]), String(raw.focus[1])] as [string, string]) : undefined;
    return {
      id: String(raw.id ?? "custom").slice(0, 40),
      title: String(raw.title ?? "Groove").slice(0, 60),
      style: STYLES.includes(raw.style) ? raw.style : "pop",
      bpm,
      bars,
      strum: /^[DU.]{8}$/.test(strum) ? strum : "D.D.D.D.",
      focus,
      tip: raw.tip ? String(raw.tip).slice(0, 200) : undefined,
      loops: Math.max(1, Math.min(8, Math.round(Number(raw.loops) || 2))),
      source: raw.source ? String(raw.source).slice(0, 12) : undefined,
      mode: ["wait", "play", "follow"].includes(raw.mode) ? raw.mode : undefined,
    };
  } catch {
    return null;
  }
}
