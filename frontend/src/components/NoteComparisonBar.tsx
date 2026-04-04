"use client";

interface Props {
  expectedNotes: string[];
  detectedNotes: string[];
  missingNotes: string[];
}

export default function NoteComparisonBar({ expectedNotes, detectedNotes, missingNotes }: Props) {
  const missingSet = new Set(missingNotes);
  const detectedSet = new Set(detectedNotes);

  return (
    <div className="flex flex-wrap gap-2">
      {expectedNotes.map((note, i) => {
        const isDetected = detectedSet.has(note);
        const isMissing = missingSet.has(note);

        return (
          <span
            key={note}
            className={`
              px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all
              ${isDetected
                ? "bg-green-500/15 text-green-300 border-green-500/30 glow-green"
                : isMissing
                  ? "bg-red-500/15 text-red-300 border-red-500/30"
                  : "bg-white/5 text-gray-400 border-white/10"
              }
            `}
            style={{
              animation: `fade-in-up 0.3s ease-out ${i * 0.05}s both`,
            }}
          >
            {isDetected && (
              <svg className="inline w-3 h-3 mr-1 -mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
            {isMissing && (
              <svg className="inline w-3 h-3 mr-1 -mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            {note}
          </span>
        );
      })}
    </div>
  );
}
