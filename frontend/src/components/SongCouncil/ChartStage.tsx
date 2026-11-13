"use client";

import { useState } from "react";
import Link from "next/link";
import SongSheetPlayer from "@/components/SongSheet/SongSheetPlayer";
import { sectionAnchor } from "@/components/SongSheet/SheetView";
import { useAuth } from "@/context/AuthContext";
import { saveSong, type LessonDocument, type SectionLesson } from "@/lib/api";

interface Props {
  lesson: LessonDocument;
  onPracticeChord: (chordKey: string) => void;
  onComplete: () => void;
}

/** Link to the changes trainer for one chord change, or null if either chord has no lesson. */
export function changesHref(c: { from_key: string | null; to_key: string | null; from_symbol: string; to_symbol: string }): string | null {
  if (!c.from_key || !c.to_key) return null;
  const q = new URLSearchParams({ mode: "transitions", a: c.from_key, b: c.to_key, sa: c.from_symbol, sb: c.to_symbol });
  return `/practice?${q}`;
}

function SectionLessonCard({
  lesson,
  index,
  onPracticeChord,
}: {
  lesson: SectionLesson;
  index: number;
  onPracticeChord: (chordKey: string) => void;
}) {
  const jump = () => {
    document.getElementById(sectionAnchor(lesson.name))?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  return (
    <article className="glass-card p-4 space-y-3" aria-labelledby={`section-lesson-${index}`}>
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id={`section-lesson-${index}`} className="font-semibold text-gray-100">
          Lesson {index + 1}: {lesson.name}
        </h3>
        {lesson.start_bpm && lesson.target_bpm && (
          <span className="text-xs text-gray-400">
            {lesson.start_bpm} → {lesson.target_bpm} bpm
          </span>
        )}
      </header>

      <p className="font-mono text-sm text-gray-300 break-words">
        | {lesson.bars.join(" | ")} |{lesson.repeat > 1 ? ` ×${lesson.repeat}` : ""}
      </p>

      <div>
        <p className="text-xs uppercase tracking-wider text-gray-500 mb-1.5">Chords</p>
        <div className="flex flex-wrap gap-2">
          {lesson.chords.map((c) => {
            const key = lesson.chord_keys[c];
            const isNew = lesson.new_chords.includes(c);
            return key ? (
              <button
                key={c}
                type="button"
                onClick={() => onPracticeChord(key)}
                className="h-8 px-3 rounded-lg border border-white/10 text-sm text-gray-100 hover:bg-white/5"
                title={`Practise ${c} with the microphone`}
              >
                {c}
                {isNew && <span className="ml-1.5 text-[10px] uppercase text-amber-300">new</span>}
              </button>
            ) : (
              <span key={c} className="h-8 px-3 inline-flex items-center rounded-lg border border-white/5 text-sm text-gray-400" title="No mic lesson for this chord yet">
                {c}
              </span>
            );
          })}
        </div>
      </div>

      {lesson.changes.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-wider text-gray-500 mb-1.5">Changes to drill</p>
          <ul className="flex flex-wrap gap-2">
            {lesson.changes.map((c) => {
              const href = changesHref(c);
              const label = `${c.from_symbol} → ${c.to_symbol}`;
              return (
                <li key={label}>
                  {href ? (
                    <Link href={href} className="h-8 px-3 inline-flex items-center rounded-lg bg-white/5 text-sm text-gray-100 hover:bg-white/10">
                      {label} <span className="ml-1.5 text-xs text-gray-400">1-min drill</span>
                    </Link>
                  ) : (
                    <span className="h-8 px-3 inline-flex items-center rounded-lg bg-white/5 text-sm text-gray-400">{label}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <ol className="list-decimal pl-5 space-y-1 text-sm text-gray-300">
        {lesson.steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>

      <button type="button" onClick={jump} className="text-sm text-amber-300 hover:underline">
        Show {lesson.name} on the chart ↑
      </button>
    </article>
  );
}

export default function ChartStage({ lesson, onPracticeChord, onComplete }: Props) {
  const { user } = useAuth();
  const [saved, setSaved] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sections = lesson.section_lessons ?? [];

  if (!lesson.chart) {
    return (
      <div className="glass-card p-6 text-sm text-gray-300">
        This lesson was created before chord charts were added. Search for the song again to get its chart and
        section lessons.
      </div>
    );
  }

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const sheet = await saveSong(lesson.chart!, "private");
      setSaved(sheet.id);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "Couldn't save the chart.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-400 max-w-prose">
          AI-generated chord chart — chords only, no lyrics, and it may differ from the recording, so trust
          your ears. Transpose, use a capo, simplify chords, autoscroll (Space), and open tabs for every shape.
        </p>
        {user ? (
          saved ? (
            <Link href={`/songs/view?id=${encodeURIComponent(saved)}`} className="h-9 px-4 inline-flex items-center rounded-lg bg-white/10 text-sm text-gray-100">
              Saved — open in My songs →
            </Link>
          ) : (
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="h-9 px-4 rounded-lg bg-amber-400 text-sm font-semibold text-gray-900 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save to my songs"}
            </button>
          )
        ) : (
          <Link href="/login?next=/songs" className="text-sm text-amber-300 hover:underline">
            Sign in to save this chart
          </Link>
        )}
      </div>
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}

      <SongSheetPlayer content={lesson.chart} />

      {sections.length > 0 && (
        <section aria-labelledby="section-lessons-heading" className="space-y-4">
          <h2 id="section-lessons-heading" className="text-lg font-semibold text-gray-100">
            Section lessons
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {sections.map((s, i) => (
              <SectionLessonCard key={s.name} lesson={s} index={i} onPracticeChord={onPracticeChord} />
            ))}
          </div>
        </section>
      )}

      <div className="flex justify-end">
        <button type="button" onClick={onComplete} className="h-10 px-5 rounded-lg bg-white/10 text-sm font-semibold text-gray-100 hover:bg-white/15">
          Next: Quiz →
        </button>
      </div>
    </div>
  );
}
