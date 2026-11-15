import { describe, expect, it } from "vitest";
import { buildSongSession, songSlug, songSessionId } from "./songLesson";

const chart = `{title: Test Song}
{key: G}
{tempo: 92}
{start_of_grid: Verse}
| G . | D . | Em . | C . |
{end_of_grid}
{start_of_grid: Chorus}
| C . | G . | D . | D . |
{end_of_grid}`;

describe("song lessons", () => {
  it("slugs fit the API's session id", () => {
    const id = songSessionId(songSlug("A Very Long Song Title That Goes On And On", "Some Artist"));
    expect(id).toMatch(/^[a-z0-9-]{2,40}$/);
  });

  it("builds learn, change, sections and the whole song", () => {
    const s = buildSongSession("test", { title: "Test Song", artist: "Band", chart, summary: "A **bright** song." }, new Set(["G", "D"]));
    const kinds = s.steps.map((x) => x.kind);
    expect(kinds[0]).toBe("read");
    // Em and C are new; G and D are known
    expect(s.steps.filter((x) => x.kind === "learn").map((x) => (x as { chord: string }).chord)).toEqual(["Em", "C"]);
    const grooves = s.steps.filter((x) => x.kind === "groove") as { groove: { bars: string[][] }; label?: string }[];
    expect(grooves[0].label).toBe("The trickiest change");
    expect(grooves.map((x) => x.label)).toContain("Verse");
    expect(grooves.map((x) => x.label)).toContain("Chorus");
    expect(grooves[grooves.length - 1].label).toBe("Whole song");
  });
});
