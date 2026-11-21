/**
 * Theme: "dark" (Stage Lights, the default) or "light" (Stage Lights by day).
 * Saved on this device and applied before the page paints (THEME_BOOT_SCRIPT).
 */
export type Theme = "dark" | "light";
const KEY = "os:theme";

export const THEME_BOOT_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(KEY)});if(t==="light")document.documentElement.dataset.theme="light";}catch(e){}})();`;

export function getTheme(): Theme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

const listeners = new Set<(t: Theme) => void>();

export function setTheme(t: Theme): void {
  if (t === "light") document.documentElement.dataset.theme = "light";
  else delete document.documentElement.dataset.theme;
  try {
    localStorage.setItem(KEY, t);
  } catch {
    /* storage blocked: it still applies for this visit */
  }
  listeners.forEach((l) => l(t));
}

export function onThemeChange(l: (t: Theme) => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** A theme colour as [r, g, b], for canvas drawing (canvas can't read CSS variables). */
export function themeRgb(name: string, fallback: [number, number, number] = [243, 242, 255]): [number, number, number] {
  if (typeof document === "undefined") return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim();
  const parts = raw.split(/[\s,]+/).map(Number);
  return parts.length >= 3 && parts.every((n) => Number.isFinite(n)) ? [parts[0], parts[1], parts[2]] : fallback;
}

/** "rgba(r,g,b,a)" for a theme colour. */
export const themeRgba = (name: string, a: number) => `rgba(${themeRgb(name).join(",")},${a})`;
