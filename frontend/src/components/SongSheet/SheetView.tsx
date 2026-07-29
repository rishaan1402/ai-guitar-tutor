"use client";

import type { Line, Section, Sheet } from "@/lib/chordpro";

interface Props {
  /** Sheet with chords already transposed/simplified for display. */
  sheet: Sheet;
  fontSize: number;
  activeChord: string | null;
  onChordClick: (chord: string) => void;
}

const SECTION_DEFAULT_LABEL: Record<Section["kind"], string | null> = {
  verse: "Verse",
  chorus: "Chorus",
  bridge: "Bridge",
  tab: "Tab",
  grid: null,
  other: null,
};

function ChordButton({ chord, active, onClick }: { chord: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`font-semibold rounded px-0.5 -mx-0.5 transition-colors ${
        active ? "bg-violet-500/25 text-violet-200" : "text-violet-300 hover:text-violet-200"
      }`}
    >
      {chord}
    </button>
  );
}

function LineView({ line, activeChord, onChordClick }: { line: Line } & Pick<Props, "activeChord" | "onChordClick">) {
  switch (line.type) {
    case "blank":
      return <div className="h-3" aria-hidden />;
    case "comment":
      return <p className="text-gray-400 italic text-[0.85em] my-1">{line.text}</p>;
    case "tab":
      return <pre className="font-mono text-[0.85em] leading-snug text-gray-200 whitespace-pre">{line.text}</pre>;
    case "lyrics": {
      const hasChords = line.segments.some((s) => s.chord);
      return (
        <div className="flex flex-wrap items-end">
          {line.segments.map((seg, i) => (
            <span key={i} className="inline-flex flex-col">
              {hasChords && (
                <span className="leading-tight min-h-[1.25em] pr-2">
                  {seg.chord && (
                    <ChordButton
                      chord={seg.chord}
                      active={seg.chord === activeChord}
                      onClick={() => onChordClick(seg.chord!)}
                    />
                  )}
                </span>
              )}
              <span className="whitespace-pre text-gray-100 leading-snug">{seg.text || " "}</span>
            </span>
          ))}
        </div>
      );
    }
    case "bars":
      return (
        <div className="grid grid-cols-2 sm:grid-cols-4 my-1">
          {line.bars.map((bar, i) => (
            <div key={i} className="flex items-center gap-3 border-l border-white/15 px-3 py-2 min-h-[2.5em]">
              {bar.map((beat, j) =>
                beat === "." || beat === "/" ? (
                  <span key={j} className="text-gray-600" aria-hidden>·</span>
                ) : beat === "%" ? (
                  <span key={j} className="text-gray-400" title="Repeat previous bar">%</span>
                ) : (
                  <ChordButton key={j} chord={beat} active={beat === activeChord} onClick={() => onChordClick(beat)} />
                ),
              )}
            </div>
          ))}
        </div>
      );
  }
}

export default function SheetView({ sheet, fontSize, activeChord, onChordClick }: Props) {
  return (
    <div style={{ fontSize }} className="space-y-6">
      {sheet.sections.map((section, i) => {
        const label = section.label ?? SECTION_DEFAULT_LABEL[section.kind];
        return (
          <section
            key={i}
            className={section.kind === "chorus" ? "border-l-2 border-violet-500/50 pl-4" : undefined}
          >
            {label && (
              <h3 className="text-[0.75em] uppercase tracking-wider text-gray-400 font-semibold mb-2">{label}</h3>
            )}
            <div className={section.kind === "tab" ? "overflow-x-auto rounded-lg bg-black/30 p-3" : undefined}>
              {section.lines.map((line, j) => (
                <LineView key={j} line={line} activeChord={activeChord} onChordClick={onChordClick} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
