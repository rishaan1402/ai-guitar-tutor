import { describe, expect, it } from "vitest";
import { CATALOG, chordBySlug, chordPageHref, formula } from "./catalog";
import { buildFingering } from "./voicing";
import { parseSymbol } from "./quality";

describe("chord catalog", () => {
  it("has a page per root and type, with readable slugs", () => {
    expect(CATALOG.length).toBeGreaterThanOrEqual(12 * 15);
    expect(chordBySlug("a-minor")?.symbol).toBe("Am");
    expect(chordBySlug("c-sharp-m7")?.symbol).toBe("C#m7");
    expect(chordBySlug("e-flat-maj7")?.symbol).toBe("Ebmaj7");
    expect(new Set(CATALOG.map((c) => c.slug)).size).toBe(CATALOG.length);
  });
  it("every catalog chord parses and has a playable shape", () => {
    for (const c of CATALOG) {
      expect(parseSymbol(c.symbol), c.symbol).not.toBeNull();
      expect(buildFingering(c.symbol), c.symbol).not.toBeNull();
    }
  });
  it("links symbols to their page, enharmonics included", () => {
    expect(chordPageHref("Am7")).toBe("/chord/a-m7");
    expect(chordPageHref("Db")).toBe("/chord/c-sharp-major");
    expect(chordPageHref("G/B")).toBeNull();
    expect(chordPageHref("C13")).toBeNull();
  });
  it("writes formulas", () => {
    expect(formula(parseSymbol("Am7")!)).toBe("1 b3 5 b7");
    expect(formula(parseSymbol("Cadd9")!)).toBe("1 3 5 9");
    expect(formula(parseSymbol("Dsus2")!)).toBe("1 2 5");
    expect(formula(parseSymbol("C6")!)).toBe("1 3 5 6");
  });
});
