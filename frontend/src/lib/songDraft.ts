/**
 * Turns an AI Council song lesson into a ChordPro chord chart, so any song
 * someone looks up can open in the song-sheet viewer.
 */
import type { LessonDocument } from "./api";

export const DRAFT_KEY = "guitar-tutor-sheet-draft";

/** "G major" -> "G", "E minor" -> "Em", "F# Minor" -> "F#m"; anything else passes through. */
export function normalizeKey(key: string | null | undefined): string | null {
  if (!key) return null;
  const m = key.trim().match(/^([A-G][#b]?)\s*(major|maj|minor|min|m)?$/i);
  if (!m) return key.trim();
  const minor = m[2] && /^m(in(or)?)?$/i.test(m[2]);
  return m[1] + (minor ? "m" : "");
}

/** Keep a directive value on one line and free of braces. */
function clean(value: string): string {
  return value.replace(/[{}\n\r]/g, " ").trim();
}

export function lessonToChordPro(lesson: LessonDocument): string {
  const out: string[] = [`{title: ${clean(lesson.song_title)}}`];
  if (lesson.artist) out.push(`{artist: ${clean(lesson.artist)}}`);
  const key = normalizeKey(lesson.key);
  if (key) out.push(`{key: ${clean(key)}}`);
  if (lesson.time_signature) out.push(`{time: ${clean(lesson.time_signature)}}`);
  const diff = (lesson.overall_difficulty || "").toLowerCase();
  if (["beginner", "intermediate", "advanced"].includes(diff)) out.push(`{difficulty: ${diff}}`);
  out.push("{comment: AI-generated chord chart. Check it by ear. One chord per bar.}");

  for (const section of lesson.song_sections ?? []) {
    const chords = section.chords.map((c) => c.trim()).filter(Boolean);
    if (!chords.length) continue;
    const name = clean(section.name || "Section");
    const kind = /chorus/i.test(name) ? "chorus" : /bridge/i.test(name) ? "bridge" : "verse";
    out.push("", `{start_of_${kind}: ${name}}`);
    for (let i = 0; i < chords.length; i += 4) {
      out.push(`| ${chords.slice(i, i + 4).join(" | ")} |`);
    }
    out.push(`{end_of_${kind}}`);
  }
  return out.join("\n") + "\n";
}

export function storeDraft(content: string): boolean {
  try {
    sessionStorage.setItem(DRAFT_KEY, content);
    return true;
  } catch {
    return false;
  }
}
