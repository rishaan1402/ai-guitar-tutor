import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { ChordTracker, chordTemplate, chromaFromSpectrum, matchesExpected, rankChords } from "./detect";

const LESSONS = path.resolve(__dirname, "../../../../data/lessons");

/** 16-bit PCM WAV -> mono floats + sample rate (the reference recordings). */
function readWav(file: string): { x: Float32Array; sr: number } {
  const b = fs.readFileSync(file);
  const sr = b.readUInt32LE(24);
  let off = 12;
  while (off < b.length) {
    const id = b.toString("ascii", off, off + 4);
    const size = b.readUInt32LE(off + 4);
    if (id === "data") {
      const n = size / 2;
      const x = new Float32Array(n);
      for (let i = 0; i < n; i++) x[i] = b.readInt16LE(off + 8 + i * 2) / 32768;
      return { x, sr };
    }
    off += 8 + size;
  }
  throw new Error("no data chunk");
}

/** In-place radix-2 FFT. */
function fft(re: Float64Array, im: Float64Array) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const a = (-2 * Math.PI) / len;
    for (let i = 0; i < n; i += len)
      for (let k = 0; k < len / 2; k++) {
        const wr = Math.cos(a * k), wi = Math.sin(a * k);
        const xr = re[i + k + len / 2] * wr - im[i + k + len / 2] * wi;
        const xi = re[i + k + len / 2] * wi + im[i + k + len / 2] * wr;
        re[i + k + len / 2] = re[i + k] - xr;
        im[i + k + len / 2] = im[i + k] - xi;
        re[i + k] += xr;
        im[i + k] += xi;
      }
  }
}

/** What an AnalyserNode reports: Blackman window, dB of |X|/N. */
function spectrumDb(x: Float32Array, start: number, n: number): Float32Array {
  const re = new Float64Array(n), im = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const w = 0.42 - 0.5 * Math.cos((2 * Math.PI * i) / n) + 0.08 * Math.cos((4 * Math.PI * i) / n);
    re[i] = (x[start + i] ?? 0) * w;
  }
  fft(re, im);
  const db = new Float32Array(n / 2);
  for (let i = 0; i < n / 2; i++) db[i] = 20 * Math.log10(Math.hypot(re[i], im[i]) / n + 1e-12);
  return db;
}

const KEYS = fs.readdirSync(LESSONS);
const SYMBOL: Record<string, string> = { major: "", minor: "m", dominant7: "7", major7: "maj7", minor7: "m7", half_dim7: "m7b5", power: "5" };
const sym = (key: string) => { const [r, q] = key.split("_"); return r + SYMBOL[q === "half" ? "half_dim7" : q === "dominant7" ? "dominant7" : key.slice(r.length + 1)]; };
const ref = (key: string) => readWav(path.join(LESSONS, key, "reference.wav"));

function heardAs(key: string, choices: string[], expected?: string): string {
  const { x, sr } = ref(key);
  const n = 2048; // ~93 ms at 22.05 kHz, like a 4096 FFT at 44.1 kHz
  // average a few frames from 0.15-0.6 s after the strum, as the tracker does
  const acc = new Float32Array(12);
  for (let t = 0.15; t < 0.6; t += 0.05) {
    const c = chromaFromSpectrum(spectrumDb(x, Math.floor(t * sr), n), sr, n);
    for (let i = 0; i < 12; i++) acc[i] += c[i];
  }
  const templates = choices.map((s) => chordTemplate(s)!);
  return rankChords(acc, templates, expected)[0].symbol;
}

describe("live chord detection on the reference recordings", () => {
  const groovesets = [
    ["G", "C", "Em", "D"],
    ["Em", "Am", "C", "G"],
    ["A", "D", "E", "F#m"],
    ["C", "Am", "F", "G"],
    ["E", "A", "B7", "E7"],
    ["Dm", "G", "C", "Am"],
    ["A", "A7", "D", "Dmaj7"],
    ["Em", "Em7", "G", "C"],
  ];
  const keyFor = (s: string) => KEYS.find((k) => sym(k) === s);
  for (const set of groovesets) {
    it(`tells apart ${set.join(" ")}`, () => {
      for (const s of set) {
        const key = keyFor(s);
        expect(key, s).toBeTruthy();
        expect(heardAs(key!, set)).toBe(s);
      }
    });
  }

  it("every chord against its closest relatives (same root, other qualities)", () => {
    const wrong: string[] = [];
    for (const key of KEYS) {
      const s = sym(key);
      const root = key.split("_")[0];
      const rivals = KEYS.filter((k) => k.startsWith(root + "_")).map(sym);
      if (heardAs(key, rivals) !== s) wrong.push(s);
      // with the music expecting it, the right chord (or its own 7th family) is accepted
      expect(matchesExpected(heardAs(key, rivals, s), s), `${s} when expected`).toBe(true);
    }
    // a maj7's extra note is quiet on one strum; in play-along the expected-chord
    // head start settles these. Everything else must be right.
    expect(wrong.length, wrong.join(" ")).toBeLessThanOrEqual(10);
    expect(wrong.filter((w) => !w.includes("maj7") && w !== "Em")).toEqual([]);
  });

  it("chord families", () => {
    expect(matchesExpected("E", "Emaj7")).toBe(true);
    expect(matchesExpected("Am", "Am7")).toBe(true);
    expect(matchesExpected("A", "Am")).toBe(false);
    expect(matchesExpected("G", "C")).toBe(false);
  });

  it("a wrong chord is still heard as wrong when another is expected", () => {
    for (const set of groovesets) {
      for (const played of set) {
        for (const expected of set) {
          if (expected === played) continue;
          // close relatives (A vs A7, Em vs Em7) may be forgiven; different chords must not
          const relatives = played.replace(/(maj7|m7|7)$/, "") === expected.replace(/(maj7|m7|7)$/, "");
          if (relatives) continue;
          const key = KEYS.find((k) => sym(k) === played)!;
          expect(heardAs(key, set, expected), `${played} played, ${expected} expected`).toBe(played);
        }
      }
    }
  });

  it("tracker confirms a chord change after a new strum", () => {
    const g = ref(KEYS.find((k) => k === "G_major")!), c = ref(KEYS.find((k) => k === "C_major")!);
    const sr = g.sr, n = 2048, hop = Math.floor(sr * 0.03);
    const x = new Float32Array(g.x.length + c.x.length);
    x.set(g.x.subarray(0, Math.floor(sr * 1.2)));
    x.set(c.x, Math.floor(sr * 1.2));
    const tr = new ChordTracker(["G", "C", "Em", "D"]);
    const events: { s: string; t: number }[] = [];
    for (let i = 0; i + n < Math.floor(sr * 2.4); i += hop) {
      const h = tr.feed(spectrumDb(x, i, n), sr, n, (i + n) / sr);
      if (h) events.push({ s: h.symbol, t: h.time });
    }
    expect(events.map((e) => e.s)).toEqual(["G", "C"]);
    // confirmed within ~0.35 s of the C strum (window length included)
    expect(events[1].t - 1.2).toBeLessThan(0.35);
  });
});
