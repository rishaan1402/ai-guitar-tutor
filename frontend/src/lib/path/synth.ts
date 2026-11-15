/** One shared little band for lesson sounds: notes, chords and clicks. */
import { Band } from "../groove/band";
import { chordNotes, midiInOctave } from "../groove/theory";

let band: Band | null = null;

export function lessonBand(): Band | null {
  if (typeof window === "undefined") return null;
  if (!band) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    band = new Band(new AC());
  }
  if (band.ctx.state === "suspended") void band.ctx.resume();
  return band;
}

/** Play notes one after another (or together, a little spread like a strum). */
export function playNotes(midis: number[], gap = 0.45, together = false): number {
  const b = lessonBand();
  if (!b) return 0;
  const t0 = b.ctx.currentTime + 0.05;
  midis.forEach((m, i) => b.note(t0 + (together ? i * 0.03 : i * gap), m));
  return together ? 1.5 : midis.length * gap + 1;
}

/** Strum a chord symbol, voiced from the low E up. */
export function playChord(symbol: string): void {
  const n = chordNotes(symbol);
  if (!n) return;
  const root = midiInOctave(n.root, 40);
  const out = [root];
  let m = root;
  while (out.length < 5 && m < 72) {
    m++;
    if (n.pcs.includes(m % 12) && m - out[out.length - 1] >= 3) out.push(m);
  }
  playNotes(out, 0, true);
}
