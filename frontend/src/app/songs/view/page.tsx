"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/ui/EmptyState";
import SongSheetPlayer from "@/components/SongSheet/SongSheetPlayer";
import { getSong, type SongDetail } from "@/lib/api";
import { DRAFT_KEY } from "@/lib/songDraft";

function SongViewer() {
  const params = useSearchParams();
  const id = params.get("id");
  const isDraft = params.get("draft") === "1";
  const [song, setSong] = useState<SongDetail | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isDraft) {
      try {
        setDraft(sessionStorage.getItem(DRAFT_KEY));
      } catch {
        setDraft(null);
      }
      return;
    }
    if (!id) {
      setError("No song selected.");
      return;
    }
    getSong(id)
      .then(setSong)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load this sheet"));
  }, [id, isDraft]);

  const content = isDraft ? draft : song?.content;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-3 mb-4">
        <Link href="/songs" className="text-sm text-gray-400 hover:text-white">
          ← All songs
        </Link>
        <div className="flex items-center gap-3">
          {song?.source === "class" && song.owner_name && (
            <span className="text-xs text-gray-500">Shared by {song.owner_name}</span>
          )}
          {song?.can_edit && (
            <Link href={`/songs/edit?id=${encodeURIComponent(song.id)}`} className="text-sm text-purple-300 hover:text-purple-200">
              Edit
            </Link>
          )}
          {isDraft && draft && (
            <Link href="/songs/edit?draft=1" className="text-sm text-purple-300 hover:text-purple-200">
              Save as my sheet
            </Link>
          )}
        </div>
      </div>

      {isDraft && draft && (
        <p className="text-xs text-amber-200/80 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 mb-4">
          AI-generated chord chart from your song lesson. It may contain mistakes, so check it by ear.
        </p>
      )}

      {error ? (
        <EmptyState title="Sheet not available" description={error} />
      ) : content ? (
        <SongSheetPlayer content={content} />
      ) : isDraft ? (
        <EmptyState title="No draft found" description="Open a song lesson and choose “Open as chord sheet”." />
      ) : (
        <div className="space-y-3">
          <div className="skeleton h-10 w-1/2 rounded" />
          <div className="skeleton h-64 rounded-xl" />
        </div>
      )}
    </div>
  );
}

export default function SongViewPage() {
  return (
    <AppShell>
      {/* useSearchParams needs a Suspense boundary for static export */}
      <Suspense fallback={null}>
        <SongViewer />
      </Suspense>
    </AppShell>
  );
}
