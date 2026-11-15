"use client";

/** "Start the song lesson": turns this AI breakdown into a step-by-step lesson on the path. */
import { useRouter } from "next/navigation";
import type { LessonDocument } from "@/lib/api";
import { saveSongLesson } from "@/lib/path/songLesson";

export default function SongLessonButton({ lesson, chart, className = "" }: { lesson: LessonDocument; chart: string | null | undefined; className?: string }) {
  const router = useRouter();
  if (!chart) return null;
  return (
    <button
      type="button"
      onClick={() => {
        const slug = saveSongLesson({
          title: lesson.song_title || "Your song",
          artist: lesson.artist,
          chart,
          summary: lesson.chairman_summary,
          technique: lesson.technique_section,
          key: lesson.key,
          time: lesson.time_signature,
          strumming: lesson.strumming,
          tempo: lesson.tempo_bpm,
        });
        router.push(`/path/session?song=${encodeURIComponent(slug)}`);
      }}
      className={`inline-flex h-12 items-center justify-center gap-2 rounded-full bg-amber-400 px-6 font-semibold text-ink-950 ${className}`}
    >
      Start the song lesson →
    </button>
  );
}
