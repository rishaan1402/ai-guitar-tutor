import { beforeEach, describe, expect, it } from "vitest";
import { isSongSaved, listSavedSongs, loadCurrentSong, removeSavedSong, saveCurrentSong, saveSong, updateSavedSong, type SongWork } from "../songStore";

const work = (id: string, title = "Wonderwall"): SongWork => ({
  lesson: { lesson_id: id, song_title: title, artist: "Oasis" } as SongWork["lesson"],
  chordScores: {}, chordScoreHistory: {}, allChordsAttempted: false, attemptCounts: {},
});

describe("song store", () => {
  beforeEach(() => localStorage.clear());
  it("keeps the song in progress across leaving the page", () => {
    saveCurrentSong(work("a"));
    expect(loadCurrentSong()?.lesson.lesson_id).toBe("a");
    saveCurrentSong(null);
    expect(loadCurrentSong()).toBeNull();
  });
  it("saves, updates and removes songs, newest first, no duplicates", () => {
    saveSong(work("a", "One"));
    saveSong(work("b", "Two"));
    saveSong(work("a", "One"));
    expect(listSavedSongs().map((s) => s.id)).toEqual(["a", "b"]);
    updateSavedSong({ ...work("b", "Two"), chordScores: { A_minor: 0.9 } });
    expect(listSavedSongs().find((s) => s.id === "b")!.work.chordScores.A_minor).toBe(0.9);
    removeSavedSong("a");
    expect(isSongSaved("a")).toBe(false);
  });
});
