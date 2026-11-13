import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import ScoreRing from "../ScoreRing";

afterEach(cleanup);

describe("ScoreRing", () => {
  it.each([72, 140])("shows the full '100%' inside a %ipx ring", (size) => {
    render(<ScoreRing score={1} size={size} strokeWidth={8} animate={false} />);
    const value = screen.getByTestId("score-ring-value");
    expect(value.textContent).toBe("100%");
    expect(value.className).not.toMatch(/text-(2|3|4)xl/);
    const fontPx = parseFloat(value.style.fontSize);
    // Bold "100%" is ~2.7em wide; it must fit inside the ring's inner track.
    expect(fontPx * 2.7).toBeLessThan(size - 2 * 8);
  });

  it("exposes the score to assistive tech", () => {
    render(<ScoreRing score={0.42} animate={false} />);
    expect(screen.getByRole("img", { name: "Score 42%" })).toBeTruthy();
  });
});
