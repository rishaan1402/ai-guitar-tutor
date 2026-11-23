import { describe, expect, it } from "vitest";
import { hitResult, planRhythm, strumPattern } from "./rhythm";

describe("strum patterns", () => {
  it("reads D/U strums into the grid", () => {
    expect(strumPattern("D DU UDU")).toEqual({ pattern: "x.xx.xxx", strokes: "D.DU.UDU" });
    expect(strumPattern("D D D D")).toEqual({ pattern: "x.x.x.x.", strokes: "D.D.D.D." });
    expect(strumPattern("dudu")).toEqual({ pattern: "xxxx", strokes: "DUDU" });
    expect(strumPattern("DUDUDUDUDUDUDUDU")?.pattern).toBe("x".repeat(16));
    expect(strumPattern("   ")).toBeNull();
    expect(strumPattern("D".repeat(17))).toBeNull();
  });
  it("plans the hits of a strum", () => {
    const p = planRhythm(strumPattern("D DU UDU")!.pattern, 60, 1);
    expect(p.hits).toEqual([0, 1, 1.5, 2.5, 3, 3.5]);
  });
  it("names each hit's timing", () => {
    expect(hitResult(12)).toBe("on");
    expect(hitResult(-70)).toBe("early");
    expect(hitResult(55)).toBe("late");
    expect(hitResult(null)).toBe("missed");
  });
});
