"use client";

/**
 * How far to trust a song's chords, said plainly, with the two things a
 * learner can do about wrong ones: tell us, or send a fixed chart.
 */
import { useRouter } from "next/navigation";
import type { LessonDocument } from "@/lib/api";
import { lessonToChordPro, storeDraft } from "@/lib/songDraft";
import ReportContent from "@/components/report/ReportContent";

function verdict(lesson: LessonDocument): { label: string; detail: string; tone: "ok" | "neutral" | "warn" } {
  if (lesson.chords_corrected) {
    return { label: "Chords checked", detail: "A learner's correction to this chart was reviewed.", tone: "ok" };
  }
  const flagged = lesson.chords_reported ?? 0;
  if (flagged > 0 || lesson.chord_confidence === "low") {
    return {
      label: "Chords may be off",
      detail: flagged > 0
        ? `${flagged} learner${flagged > 1 ? "s" : ""} said these chords don't match. Trust your ears.`
        : "The AI doesn't know this song well. Check the chords against the recording.",
      tone: "warn",
    };
  }
  if (lesson.chord_confidence === "high") {
    return { label: "Well-known chords", detail: "This is the widely taught version. Small differences from the recording are possible.", tone: "neutral" };
  }
  return { label: "Check by ear", detail: "AI-written chords: the harmony is usually right, but some bars may differ from the recording.", tone: "neutral" };
}

const TONE = {
  ok: "border-sage-300/50 bg-sage-300/10 text-sage-100",
  neutral: "border-cream/20 bg-cream/5 text-cream/80",
  warn: "border-amber-400/60 bg-amber-400/10 text-amber-100",
};

export default function ChordTrust({ lesson }: { lesson: LessonDocument }) {
  const router = useRouter();
  if (!lesson.song_id) return null; // lessons from before the song library: nothing to report against
  const v = verdict(lesson);
  const chart = lesson.chart || lessonToChordPro(lesson);

  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
      <span className={`inline-flex items-center rounded-full border px-3 py-1 font-semibold ${TONE[v.tone]}`}>{v.label}</span>
      <span className="min-w-0 flex-1 basis-60 text-cream/65">{v.detail}</span>
      <span className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => {
            if (storeDraft(chart, { song_id: lesson.song_id!, title: lesson.song_title })) router.push("/songs/edit?draft=1");
          }}
          className="text-amber-300 underline-offset-4 hover:underline"
        >
          Fix the chords
        </button>
        <ReportContent
          kind="song_chart"
          content={chart}
          context={`${lesson.song_title ?? ""} — ${lesson.artist ?? ""}`}
          songId={lesson.song_id}
          label="Chords look wrong?"
          className="text-sm"
        />
      </span>
    </div>
  );
}
