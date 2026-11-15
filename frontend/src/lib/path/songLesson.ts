/**
 * Song lessons: turn an AI song breakdown (from Learn any song) into a
 * path-style session: about the song -> its new chords (learn + check) ->
 * the strum -> the hardest change -> each section -> the whole song.
 * Saved on this device so you can come back to it from the Lessons page.
 */
import { parseChordPro } from "../chordpro";
import { toAppChordKey } from "../chordpro";
import { songGrooves, base } from "../groove/fromChart";
import { strumSlots, type Groove } from "../groove/groove";
import { chordTemplate } from "../groove/detect";
import { chord, groove, read, rhythm, S, type PathSession, type Step } from "./steps";

export interface SongLessonSource {
  title: string;
  artist?: string | null;
  /** ChordPro chart. */
  chart: string;
  summary?: string | null;
  technique?: string | null;
  key?: string | null;
  time?: string | null;
  strumming?: string | null;
  tempo?: number | null;
}

const KEY = "os:song-lessons";
const MAX_NEW = 6;

export function songSlug(title: string, artist?: string | null): string {
  const s = `${title} ${artist ?? ""}`.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return (s || "song").slice(0, 34).replace(/-+$/, "");
}

export const songSessionId = (slug: string) => `song-${slug}`;

function store(): Record<string, SongLessonSource & { saved: number }> {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}

export function saveSongLesson(src: SongLessonSource): string {
  const slug = songSlug(src.title, src.artist);
  const all = store();
  all[slug] = { ...src, saved: Date.now() };
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* storage blocked: the lesson still opens this time via the slug */
  }
  return slug;
}

export function loadSongLesson(slug: string): SongLessonSource | null {
  return store()[slug] ?? null;
}

export function listSongLessons(): { slug: string; title: string; artist?: string | null; saved: number }[] {
  return Object.entries(store())
    .map(([slug, s]) => ({ slug, title: s.title, artist: s.artist, saved: s.saved }))
    .sort((a, b) => b.saved - a.saved);
}

function trim(text: string | null | undefined, max = 900): string {
  if (!text) return "";
  const t = text.trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  return cut.slice(0, Math.max(cut.lastIndexOf("\n"), cut.lastIndexOf(". ") + 1, 200)).trim();
}

/** The change between two different chords that appears most often in the song. */
function hardestChange(bars: string[][], prefer: Set<string>): [string, string] | null {
  const counts = new Map<string, number>();
  const flat = bars.flat();
  for (let i = 1; i < flat.length; i++) {
    const a = flat[i - 1], b = flat[i];
    if (a === b) continue;
    const k = `${a}|${b}`;
    // changes into or out of a new chord count double: that's where songs fall apart
    counts.set(k, (counts.get(k) ?? 0) + (prefer.has(a) || prefer.has(b) ? 2 : 1));
  }
  const best = Array.from(counts.entries()).sort((x, y) => y[1] - x[1])[0];
  return best ? (best[0].split("|") as [string, string]) : null;
}

/**
 * Build the session. `known` is the chords you've already earned stars for on
 * the path: those skip the learn-and-check steps.
 */
export function buildSongSession(slug: string, src: SongLessonSource, known: Set<string> = new Set()): PathSession {
  const sheet = parseChordPro(src.chart);
  if (!sheet.meta.title) sheet.meta.title = src.title;
  if (!sheet.meta.time && src.time) sheet.meta.time = src.time;
  if (!sheet.meta.tempo && src.tempo) sheet.meta.tempo = src.tempo;
  if (!sheet.meta.strumming && src.strumming) sheet.meta.strumming = src.strumming;
  const parts = songGrooves(sheet);
  const whole = parts.find((p) => p.label === "Whole song") ?? parts[0];
  const sections = parts.filter((p) => p !== whole || parts.length === 1);
  const allBars = (whole?.groove.bars ?? []).map((b) => b.map(base));
  const steps: Step[] = [];

  // 1. about the song
  const facts = [
    src.key || sheet.meta.key ? `**Key:** ${src.key || sheet.meta.key}` : "",
    sheet.meta.time ? `**Time:** ${sheet.meta.time}` : "",
    sheet.meta.tempo ? `**Tempo:** about ${sheet.meta.tempo} bpm` : "",
    sheet.meta.capo ? `**Capo:** ${sheet.meta.capo}` : "",
    sheet.meta.strumming ? `**Strum:** ${sheet.meta.strumming}` : "",
  ].filter(Boolean);
  steps.push(
    read(
      src.artist ? `${src.title} · ${src.artist}` : src.title,
      [facts.map((f) => `- ${f}`).join("\n"), trim(src.summary), "This lesson builds the song up piece by piece: new chords first, then the strum, the trickiest change, each section, and finally the whole song with the band."]
        .filter(Boolean)
        .join("\n\n"),
    ),
  );

  // 2. new chords, in the order they appear
  const inSong: string[] = [];
  for (const c of allBars.flat()) if (!inSong.includes(c)) inSong.push(c);
  const fresh = inSong.filter((c) => !known.has(c) && toAppChordKey(c)).slice(0, MAX_NEW);
  for (const c of fresh) steps.push(...chord(c, `${c} appears in this song. Get the shape clean before the band comes in.`, "Strum once and let every string ring; fix any buzzing notes."));

  // 3. the strum
  const beats = whole?.groove.beatsPerBar === 3 ? 3 : 4;
  const slots = strumSlots(whole?.groove.strum ?? "D.D.D.D.", beats * 2);
  if (slots.some((s) => s !== ".") && slots.filter((s) => s !== ".").length < slots.length) {
    steps.push(rhythm("The strum", `The song's strum is **${slots.join(" ").replace(/\./g, "·")}**. Tap where the strums land.`, slots.map((s) => (s === "." ? "." : "x")).join(""), Math.min(90, sheet.meta.tempo ?? 76), 2));
  }

  // 4. the hardest change, looped
  const pair = hardestChange(allBars, new Set(fresh));
  if (pair && chordTemplate(pair[0]) && chordTemplate(pair[1])) {
    const slow = Math.max(56, Math.round((whole?.groove.bpm ?? 80) * 0.75));
    const g: Groove = { id: `${slug}-change`.slice(0, 40), title: `${pair[0]} ↔ ${pair[1]}`, style: "ballad", bpm: slow, bars: [[pair[0]], [pair[1]], [pair[0]], [pair[1]]], strum: beats === 3 ? "D.D.D." : "D...D...", loops: 2, focus: pair, beatsPerBar: beats, tip: "The change this song uses most. Lift together, land together; the band waits." };
    steps.push(groove(g, "wait", "The trickiest change"));
  }

  // 5. each section (skip exact repeats)
  const seen = new Set<string>();
  for (const s of sections.slice(0, 6)) {
    const sig = JSON.stringify(s.groove.bars);
    if (seen.has(sig) || !s.groove.bars.length) continue;
    seen.add(sig);
    steps.push(groove({ ...s.groove, title: `${src.title}: ${s.label}`.slice(0, 60) }, "wait", s.label));
  }

  // 6. technique notes from the AI breakdown
  const tech = trim(src.technique, 700);
  if (tech) steps.push(read("How to play it", tech));

  // 7. the whole song
  if (whole && parts.length > 1) steps.push(groove({ ...whole.groove, title: src.title.slice(0, 60) }, "follow", "Whole song"));

  return S(songSessionId(slug), src.title, src.artist ? `by ${src.artist}` : "Your song", ...steps);
}
