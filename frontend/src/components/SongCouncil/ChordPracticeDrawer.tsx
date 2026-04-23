"use client";

import React from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SongCouncilContext } from "./index";

interface ChordPracticeDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  context?: SongCouncilContext | null;
  onPracticeChord: (chordKey: string, context: SongCouncilContext) => void;
}

/**
 * Sheet drawer that slides in for chord practice
 * Keeps user in song lesson context while practicing individual chords
 */
export function ChordPracticeDrawer({
  isOpen,
  onClose,
  context,
  onPracticeChord,
}: ChordPracticeDrawerProps) {
  if (!context) return null;

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-md bg-gray-900 border-l border-gray-700">
        <SheetHeader>
          <SheetTitle className="text-white">
            Practice {context.chordSymbol}
          </SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          <div className="text-sm text-gray-400">
            <p>Lesson: {context.lessonId.substring(0, 8)}...</p>
            <p>Attempt: {context.attemptCount}</p>
          </div>
          <p className="text-sm text-gray-300">
            Practice this chord and record your attempt. Your feedback will help refine the lesson.
          </p>
          <button
            onClick={() => {
              onPracticeChord(context.chordKey, context);
              onClose();
            }}
            className="btn-gradient w-full px-4 py-2 rounded-lg font-semibold text-white"
          >
            Start Recording
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
