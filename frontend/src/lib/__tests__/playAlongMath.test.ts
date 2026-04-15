/**
 * Regression tests for the Play Along block-index off-by-1 bug and
 * round-complete / scoring logic.
 *
 * The Play Along scrolls a chord timeline. Block i is considered "at the
 * marker" (player should play it) when:
 *   scrollX = (i + 1) * (BLOCK_WIDTH + BLOCK_GAP)
 *
 * Correct block-index formula:
 *   blockIndex = Math.max(0, Math.floor(scrollX / stride) - 1)
 */

import { describe, it, expect } from "vitest";

const BLOCK_WIDTH = 120;
const BLOCK_GAP = 20;
const STRIDE = BLOCK_WIDTH + BLOCK_GAP; // 140

function currentBlockIndex(scrollX: number): number {
  return Math.max(0, Math.floor(scrollX / STRIDE) - 1);
}

// ---------------------------------------------------------------------------
// Block index formula
// ---------------------------------------------------------------------------

describe("Play Along block index (off-by-1 regression)", () => {
  it("block 0 at marker when scrollX=140", () => {
    expect(currentBlockIndex(140)).toBe(0);
  });

  it("block 1 at marker when scrollX=280", () => {
    expect(currentBlockIndex(280)).toBe(1);
  });

  it("block 2 at marker when scrollX=420", () => {
    expect(currentBlockIndex(420)).toBe(2);
  });

  it("scrollX=0 clamps to 0", () => {
    expect(currentBlockIndex(0)).toBe(0);
  });

  it("scrollX slightly before first marker still 0", () => {
    expect(currentBlockIndex(139)).toBe(0);
  });

  it("scrollX slightly past first marker gives block 0", () => {
    expect(currentBlockIndex(141)).toBe(0);
  });

  it("negative scrollX clamps to 0", () => {
    expect(currentBlockIndex(-50)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Match ratio scoring
// ---------------------------------------------------------------------------

function matchRatingFromRatio(matchRatio: number): "great" | "ok" | "miss" {
  if (matchRatio >= 0.65) return "great";
  if (matchRatio >= 0.3) return "ok";
  return "miss";
}

describe("Play Along match ratio scoring", () => {
  it("ratio ≥ 0.65 → 'great'", () => {
    expect(matchRatingFromRatio(0.65)).toBe("great");
    expect(matchRatingFromRatio(0.9)).toBe("great");
    expect(matchRatingFromRatio(1.0)).toBe("great");
  });

  it("ratio ≥ 0.3 and < 0.65 → 'ok'", () => {
    expect(matchRatingFromRatio(0.3)).toBe("ok");
    expect(matchRatingFromRatio(0.5)).toBe("ok");
    expect(matchRatingFromRatio(0.64)).toBe("ok");
  });

  it("ratio < 0.3 → 'miss'", () => {
    expect(matchRatingFromRatio(0.0)).toBe("miss");
    expect(matchRatingFromRatio(0.1)).toBe("miss");
    expect(matchRatingFromRatio(0.29)).toBe("miss");
  });
});

// ---------------------------------------------------------------------------
// Round complete detection
// ---------------------------------------------------------------------------

describe("Play Along round complete detection", () => {
  it("round complete when all blocks have been scored", () => {
    const totalBlocks = 5;
    const scoredBlocks = new Set([0, 1, 2, 3, 4]);
    expect(scoredBlocks.size >= totalBlocks).toBe(true);
  });

  it("round not complete when some blocks unscored", () => {
    const totalBlocks = 5;
    const scoredBlocks = new Set([0, 1, 2]);
    expect(scoredBlocks.size >= totalBlocks).toBe(false);
  });

  it("empty block list is immediately complete", () => {
    const totalBlocks = 0;
    const scoredBlocks = new Set<number>();
    expect(scoredBlocks.size >= totalBlocks).toBe(true);
  });
});
