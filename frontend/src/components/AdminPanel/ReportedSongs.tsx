"use client";

/**
 * Songs whose chords learners flagged. For each: the chart everyone gets now,
 * and any corrected charts learners sent. Publishing one gives it to everyone
 * who opens the song; dismissing clears the reports.
 */
import { useEffect, useState } from "react";
import { dismissSongReports, getReportedSongs, publishSongChart, type ReportedSong } from "@/lib/api";

export default function ReportedSongs() {
  const [songs, setSongs] = useState<ReportedSong[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => getReportedSongs().then(setSongs).catch((e) => setError(e instanceof Error ? e.message : "Couldn't load reports"));
  useEffect(() => {
    load();
  }, []);

  const act = async (songId: string, fn: () => Promise<void>) => {
    setBusy(songId);
    setError(null);
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't work");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="panel overflow-hidden" aria-labelledby="reported-songs-h">
      <div className="px-4 py-3 panel-header">
        <h2 id="reported-songs-h" className="text-sm font-semibold text-gray-300">Song chords learners flagged</h2>
      </div>
      <div className="space-y-4 p-4">
        {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
        {songs === null && !error && <p className="text-sm text-gray-400">Loading…</p>}
        {songs?.length === 0 && <p className="text-sm text-gray-400">Nothing flagged. Every song&apos;s chords stand as written.</p>}
        {songs?.map((s) => (
          <article key={s.song_id} className="rounded-xl border border-white/10 p-4">
            <header className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-semibold text-cream">
                {s.title} {s.artist && <span className="font-normal text-cream/60">· {s.artist}</span>}
              </h3>
              <span className="text-xs text-amber-200">
                {s.reports} report{s.reports === 1 ? "" : "s"}
                {s.edited_at ? " · corrected before" : ""}
              </span>
            </header>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <div className="min-w-0">
                <p className="mb-1 text-xs uppercase tracking-wider text-gray-400">Chart now</p>
                <pre className="max-h-64 overflow-auto rounded-lg bg-black/30 p-3 text-xs text-gray-200">{s.chart || "(no chart)"}</pre>
              </div>
              <div className="min-w-0 space-y-3">
                {s.suggestions.length === 0 && <p className="text-sm text-gray-400">No corrected chart sent, only reports.</p>}
                {s.suggestions.map((g, i) => (
                  <div key={g.report_id}>
                    <p className="mb-1 text-xs uppercase tracking-wider text-gray-400">
                      Suggested fix {s.suggestions.length > 1 ? i + 1 : ""}
                      {g.note && g.note !== "Suggested correction." && <span className="normal-case tracking-normal text-gray-300"> · {g.note.replace(/^Suggested correction\.\s*/, "")}</span>}
                    </p>
                    <pre className="max-h-64 overflow-auto rounded-lg bg-black/30 p-3 text-xs text-gray-200">{g.chart}</pre>
                    <button
                      type="button"
                      disabled={busy === s.song_id}
                      onClick={() => act(s.song_id, () => publishSongChart(s.song_id, g.chart))}
                      className="mt-2 rounded-full bg-amber-400 px-4 py-1.5 text-sm font-semibold text-ink-950 disabled:opacity-60"
                    >
                      Publish this chart
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <button
              type="button"
              disabled={busy === s.song_id}
              onClick={() => act(s.song_id, () => dismissSongReports(s.song_id))}
              className="mt-3 text-sm text-gray-300 underline-offset-4 hover:underline disabled:opacity-60"
            >
              Chords are fine, clear reports
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
