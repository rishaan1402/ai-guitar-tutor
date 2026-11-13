/** Calendar-heatmap layout: weeks oldest → newest, Sunday-aligned, local dates. */

export interface DayActivity {
  attempts: number;
  avg_score: number;
}

export interface HeatmapCell {
  /** Local calendar date, YYYY-MM-DD. */
  date: string;
  attempts: number;
  avg_score: number;
  isToday: boolean;
  /** Day after today (padding at the end of the current week). */
  isFuture: boolean;
}

export interface HeatmapWeek {
  /** Short month name when this week contains the 1st of a month (or is the first column). */
  monthLabel: string | null;
  days: HeatmapCell[]; // always 7, Sunday..Saturday
}

/** YYYY-MM-DD in the browser's local zone (never toISOString, which is UTC). */
export function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function buildHeatmapWeeks(
  activity: Record<string, DayActivity>,
  today: Date = new Date(),
  weekCount = 53,
): HeatmapWeek[] {
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const todayKey = localDateKey(end);
  // Sunday of the current week, then step back to the first column.
  const start = new Date(end);
  start.setDate(end.getDate() - end.getDay() - (weekCount - 1) * 7);

  const weeks: HeatmapWeek[] = [];
  const cursor = new Date(start);
  for (let w = 0; w < weekCount; w++) {
    const days: HeatmapCell[] = [];
    let monthLabel: string | null = null;
    for (let d = 0; d < 7; d++) {
      const key = localDateKey(cursor);
      if (cursor.getDate() === 1 || (w === 0 && d === 0)) monthLabel = MONTHS[cursor.getMonth()];
      const a = activity[key];
      days.push({
        date: key,
        attempts: a?.attempts ?? 0,
        avg_score: a?.avg_score ?? 0,
        isToday: key === todayKey,
        isFuture: cursor.getTime() > end.getTime(),
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push({ monthLabel, days });
  }
  // A label in the first column right before another month's label is noise.
  if (weeks.length > 1 && weeks[0].monthLabel && weeks[1].monthLabel) weeks[0].monthLabel = null;
  return weeks;
}

export function activityMap(days: { date: string; attempts: number; avg_score: number }[]): Record<string, DayActivity> {
  const map: Record<string, DayActivity> = {};
  for (const d of days) map[d.date] = { attempts: d.attempts, avg_score: d.avg_score };
  return map;
}
