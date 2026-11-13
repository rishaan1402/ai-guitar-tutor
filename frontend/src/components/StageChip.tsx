import { STAGE_CHIP, stageLabel, stageTone, type StageLike } from "@/lib/mastery";

/** Mastery stage chip: sage = mastered, amber = re-check due, neutral = verifying / learning. */
export default function StageChip({ item, className = "" }: { item: StageLike; className?: string }) {
  const tone = stageTone(item);
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STAGE_CHIP[tone]} ${className}`}
      data-stage={tone}
    >
      {stageLabel(item)}
    </span>
  );
}
