/**
 * Interface sounds for the practice room: a synthesized guitar-string pluck
 * (Karplus-Strong) and a soft open-chord strum. No audio files are loaded.
 *
 * Off by default. The preference lives in localStorage and is shared across
 * tabs/components through a tiny subscribe API (useSyncExternalStore-ready).
 */

const KEY = "open-strings-sound";
let enabled = false;
let loaded = false;
let ctx: AudioContext | null = null;
const listeners = new Set<() => void>();

function load(): void {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    enabled = localStorage.getItem(KEY) === "on";
  } catch {
    enabled = false;
  }
}

export function isSoundOn(): boolean {
  load();
  return enabled;
}

export function setSoundOn(on: boolean): void {
  load();
  enabled = on;
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    // private mode: preference just won't persist
  }
  listeners.forEach((l) => l());
  if (on) pluck(196); // confirm with a G
}

export function subscribeSound(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** Karplus-Strong plucked string buffer at `freq` Hz. */
function stringBuffer(ac: AudioContext, freq: number, seconds = 1.6, brightness = 0.5): AudioBuffer {
  const sr = ac.sampleRate;
  const len = Math.floor(sr * seconds);
  const buf = ac.createBuffer(1, len, sr);
  const out = buf.getChannelData(0);
  const period = Math.max(2, Math.round(sr / freq));
  // Excite the string with noise; a one-pole low-pass on the burst makes a
  // softer (fingertip) attack as brightness goes down.
  const ring = new Float32Array(period);
  let lp = 0;
  for (let i = 0; i < period; i++) {
    const n = Math.random() * 2 - 1;
    lp = brightness * n + (1 - brightness) * lp;
    ring[i] = lp;
  }
  const decay = 0.996;
  let idx = 0;
  for (let i = 0; i < len; i++) {
    const next = (idx + 1) % period;
    // classic Karplus-Strong: average neighbours (low-pass) and decay
    const v = decay * 0.5 * (ring[idx] + ring[next]);
    out[i] = ring[idx];
    ring[idx] = v;
    idx = next;
  }
  return buf;
}

function play(freq: number, when = 0, gain = 0.22, brightness = 0.35): void {
  const ac = audio();
  if (!ac) return;
  const src = ac.createBufferSource();
  src.buffer = stringBuffer(ac, freq, 1.6, brightness);
  const g = ac.createGain();
  g.gain.value = gain;
  src.connect(g).connect(ac.destination);
  src.start(ac.currentTime + when);
}

/** One string pluck (if sound is on). */
export function pluck(freq = 196): void {
  if (!isSoundOn()) return;
  play(freq);
}

// Open strings of a guitar, low E to high e
export const OPEN_STRINGS_HZ = [82.41, 110.0, 146.83, 196.0, 246.94, 329.63];

/** Down-strum of the six open strings (Em7add11 — the "open strings" chord). */
export function strumOpen(): void {
  if (!isSoundOn()) return;
  OPEN_STRINGS_HZ.forEach((f, i) => play(f, i * 0.022, 0.12, 0.3));
}

/** Strum a chord given note frequencies (low to high). */
export function strum(freqs: number[], gap = 0.025): void {
  if (!isSoundOn()) return;
  freqs.forEach((f, i) => play(f, i * gap, 0.12, 0.3));
}
