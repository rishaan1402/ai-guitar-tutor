"use client";

import React from "react";

interface NoteDiffStripProps {
  expectedNotes: string[];
  detectedNotes: string[];
  missingNotes: string[];
  extraNotes?: string[];
  onNoteHover?: (note: string | null) => void;
}

/**
 * Structured note comparison strip
 * Shows three columns: Expected / Detected / Missing
 * Displays notes as interactive pills
 */
export function NoteDiffStrip({
  expectedNotes,
  detectedNotes,
  missingNotes,
  extraNotes = [],
  onNoteHover,
}: NoteDiffStripProps) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        {/* Expected Notes */}
        <div className="space-y-1.5">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Expected</h4>
          <div className="flex flex-wrap gap-1">
            {expectedNotes.length === 0 ? (
              <span className="text-xs text-gray-600">None</span>
            ) : (
              expectedNotes.map((note) => (
                <span
                  key={`expected-${note}`}
                  className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold"
                  style={{
                    background: "rgba(147,197,253,0.15)",
                    border: "1px solid rgba(147,197,253,0.4)",
                    color: "#93c5fd",
                  }}
                  onMouseEnter={() => onNoteHover?.(note)}
                  onMouseLeave={() => onNoteHover?.(null)}
                >
                  {note}
                </span>
              ))
            )}
          </div>
        </div>

        {/* Detected Notes */}
        <div className="space-y-1.5">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Detected</h4>
          <div className="flex flex-wrap gap-1">
            {detectedNotes.length === 0 ? (
              <span className="text-xs text-gray-600">None</span>
            ) : (
              detectedNotes.map((note) => (
                <span
                  key={`detected-${note}`}
                  className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold"
                  style={{
                    background: "rgba(34,197,94,0.15)",
                    border: "1px solid rgba(34,197,94,0.4)",
                    color: "#86efac",
                  }}
                  onMouseEnter={() => onNoteHover?.(note)}
                  onMouseLeave={() => onNoteHover?.(null)}
                >
                  {note}
                </span>
              ))
            )}
          </div>
        </div>

        {/* Missing Notes */}
        <div className="space-y-1.5">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Missing</h4>
          <div className="flex flex-wrap gap-1">
            {missingNotes.length === 0 ? (
              <span className="text-xs text-gray-600">None</span>
            ) : (
              missingNotes.map((note) => (
                <span
                  key={`missing-${note}`}
                  className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold animate-pulse"
                  style={{
                    background: "rgba(239,68,68,0.15)",
                    border: "1px solid rgba(239,68,68,0.4)",
                    color: "#fca5a5",
                  }}
                  onMouseEnter={() => onNoteHover?.(note)}
                  onMouseLeave={() => onNoteHover?.(null)}
                >
                  {note}
                </span>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Extra notes info */}
      {extraNotes.length > 0 && (
        <div className="pt-2 border-t border-gray-700">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
            Extra Notes
          </h4>
          <div className="flex flex-wrap gap-1">
            {extraNotes.map((note) => (
              <span
                key={`extra-${note}`}
                className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold"
                style={{
                  background: "rgba(251,191,36,0.15)",
                  border: "1px solid rgba(251,191,36,0.4)",
                  color: "#fcd34d",
                }}
                onMouseEnter={() => onNoteHover?.(note)}
                onMouseLeave={() => onNoteHover?.(null)}
              >
                {note}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
