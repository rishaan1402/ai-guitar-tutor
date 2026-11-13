"use client";

import { formatChord } from "@/lib/chordName";

interface Props {
  videoPath: string | null;
  audioUrl: string | null;
  chordName: string;
  onVideoEnd?: () => void;
  onAudioEnd?: () => void;
  /** Lesson still loading: reserve the video's box (no layout shift when it arrives). */
  pending?: boolean;
}

export default function LessonVideoPlayer({ videoPath, audioUrl, chordName, onVideoEnd, onAudioEnd, pending }: Props) {
  if (pending) {
    return (
      <div className="glass rounded-2xl overflow-hidden" aria-busy="true" data-testid="video-pending">
        <div className="px-4 py-3 border-b border-white/10">
          <h3 className="text-lg font-semibold gradient-text">{formatChord(chordName) || "\u00a0"}</h3>
        </div>
        <div className="aspect-video bg-black/50 animate-pulse" />
      </div>
    );
  }
  if (!videoPath && !audioUrl) return null;

  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-white/10">
        <h3 className="text-lg font-semibold gradient-text">
          {formatChord(chordName)}
        </h3>
      </div>

      {videoPath && (
        <div className="aspect-video bg-black/50 flex items-center justify-center">
          <video
            src={videoPath}
            controls
            className="w-full h-full"
            onEnded={onVideoEnd}
            onError={() => onVideoEnd?.()}
          >
            <p className="text-gray-400">Your browser does not support video playback.</p>
          </video>
        </div>
      )}

      {audioUrl && (
        <div className="px-4 py-3 border-t border-white/10 flex items-center gap-3">
          <span className="text-sm text-gray-300 whitespace-nowrap">Reference:</span>
          <audio
            src={audioUrl}
            controls
            className="h-8 w-full"
            onEnded={onAudioEnd}
          />
        </div>
      )}
    </div>
  );
}
