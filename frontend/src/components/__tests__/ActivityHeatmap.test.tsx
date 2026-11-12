import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import { ActivityHeatmap } from "../ActivityHeatmap";

afterEach(cleanup);

const today = new Date(2026, 10, 12, 12);

describe("ActivityHeatmap", () => {
  it("renders oldest → newest", () => {
    const { container } = render(
      <ActivityHeatmap days={[{ date: "2026-11-10", attempts: 2, avg_score: 0.8 }]} today={today} />,
    );
    const dates = Array.from(container.querySelectorAll<HTMLElement>("[data-date]")).map((c) => c.dataset.date!);
    expect(dates[0] < dates[dates.length - 1]).toBe(true);
    expect(dates[dates.length - 1]).toBe("2026-11-12");
  });

  it("has no focusable cells and a single labelled image", () => {
    const { container } = render(<ActivityHeatmap days={[]} today={today} />);
    expect(container.querySelectorAll("button").length).toBe(0);
    const img = screen.getByRole("img");
    expect(img.getAttribute("aria-label")).toMatch(/No practice/);
    expect(img.querySelectorAll("[tabindex], a, button, input").length).toBe(0);
    expect(container.querySelectorAll("[data-testid=heatmap-cell]").length).toBe(53 * 7);
  });

  it("summarises practice days", () => {
    render(
      <ActivityHeatmap
        days={[
          { date: "2026-11-10", attempts: 2, avg_score: 0.8 },
          { date: "2026-11-11", attempts: 1, avg_score: 1 },
        ]}
        today={today}
      />,
    );
    expect(screen.getByRole("img").getAttribute("aria-label")).toBe(
      "2 practice days and 3 attempts in the last year",
    );
  });
});
