import { MOCK_NOW } from "@/data/time";
import type { ContentItem } from "@/types";

export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export interface CalendarDay {
  iso: string;
  date: number;
  inCurrentMonth: boolean;
  isToday: boolean;
  weekend: boolean;
  items: ContentItem[];
}

/** Monday-first month grid, 6 weeks, so the calendar never reflows. */
export function buildMonthGrid(anchor: Date = MOCK_NOW): CalendarDay[] {
  const year = anchor.getUTCFullYear();
  const month = anchor.getUTCMonth();
  const first = new Date(Date.UTC(year, month, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  const start = new Date(Date.UTC(year, month, 1 - offset));

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    const dayOfWeek = date.getUTCDay();
    return {
      iso: date.toISOString(),
      date: date.getUTCDate(),
      inCurrentMonth: date.getUTCMonth() === month,
      isToday: sameDay(date, anchor),
      weekend: dayOfWeek === 0 || dayOfWeek === 6,
      items: [],
    };
  });
}

export function sameDay(a: Date, b: Date) {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

/** Attach content to the matching grid day (mutates a copy, never the input). */
export function attachItemsToGrid(
  grid: CalendarDay[],
  items: ContentItem[],
): CalendarDay[] {
  const withItems = grid.map((day) => ({ ...day, items: [] as ContentItem[] }));

  for (const item of items) {
    if (!item.scheduledFor) continue;
    const scheduled = new Date(item.scheduledFor);
    const day = withItems.find((candidate) =>
      sameDay(new Date(candidate.iso), scheduled),
    );
    if (day) day.items.push(item);
  }

  for (const day of withItems) {
    day.items.sort(
      (a, b) =>
        new Date(a.scheduledFor ?? 0).getTime() -
        new Date(b.scheduledFor ?? 0).getTime(),
    );
  }

  return withItems;
}

export function buildMonthCalendar(
  items: ContentItem[],
  anchor: Date = MOCK_NOW,
): CalendarDay[] {
  return attachItemsToGrid(buildMonthGrid(anchor), items);
}

/** Seven-day strip used by the dashboard calendar preview. */
export function buildWeekStrip(
  items: ContentItem[],
  anchor: Date = MOCK_NOW,
): CalendarDay[] {
  const weekdayIndex = (anchor.getUTCDay() + 6) % 7;
  const monday = new Date(anchor);
  monday.setUTCDate(anchor.getUTCDate() - weekdayIndex);

  const week = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setUTCDate(monday.getUTCDate() + index);
    const dayOfWeek = date.getUTCDay();
    return {
      iso: date.toISOString(),
      date: date.getUTCDate(),
      inCurrentMonth: date.getUTCMonth() === anchor.getUTCMonth(),
      isToday: sameDay(date, anchor),
      weekend: dayOfWeek === 0 || dayOfWeek === 6,
      items: [] as ContentItem[],
    };
  });

  return attachItemsToGrid(week, items);
}

export function formatMonthLabel(anchor: Date = MOCK_NOW) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(anchor);
}
