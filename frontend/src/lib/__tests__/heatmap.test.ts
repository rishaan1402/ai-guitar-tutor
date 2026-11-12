import { describe, it, expect } from "vitest";
import { buildHeatmapWeeks, localDateKey } from "../heatmap";

describe("buildHeatmapWeeks", () => {
  // Wednesday 12 Nov 2026, local time
  const today = new Date(2026, 10, 12, 21, 30);

  it("runs oldest → newest and ends with the current week", () => {
    const weeks = buildHeatmapWeeks({}, today);
    expect(weeks).toHaveLength(53);
    const first = weeks[0].days[0].date;
    const last = weeks[52].days[6].date;
    expect(first < last).toBe(true);
    const flat = weeks.flatMap((w) => w.days.map((d) => d.date));
    expect([...flat].sort()).toEqual(flat);
    expect(flat).toContain("2026-11-12");
  });

  it("aligns columns to Sunday", () => {
    const weeks = buildHeatmapWeeks({}, today);
    for (const w of weeks) {
      const [y, m, d] = w.days[0].date.split("-").map(Number);
      expect(new Date(y, m - 1, d).getDay()).toBe(0);
    }
  });

  it("uses local dates, marks today and pads the future", () => {
    const weeks = buildHeatmapWeeks({ "2026-11-12": { attempts: 3, avg_score: 0.5 } }, today);
    const cur = weeks[52].days;
    const t = cur.find((d) => d.isToday)!;
    expect(t.date).toBe("2026-11-12");
    expect(t.attempts).toBe(3);
    expect(cur.filter((d) => d.isFuture).map((d) => d.date)).toEqual(["2026-11-13", "2026-11-14"]);
  });

  it("labels months", () => {
    const labels = buildHeatmapWeeks({}, today).map((w) => w.monthLabel).filter(Boolean);
    expect(labels).toContain("Nov");
    expect(labels).toContain("Jan");
  });

  it("localDateKey never shifts to UTC", () => {
    expect(localDateKey(new Date(2026, 0, 1, 23, 59))).toBe("2026-01-01");
  });
});
