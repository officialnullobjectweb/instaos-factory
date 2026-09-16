/**
 * UTC date helpers for the calendar primitives.
 *
 * Everything the UI reasons about is a date-only string (`YYYY-MM-DD`). Using
 * strings rather than `Date` objects means two renders of the same day are
 * always equal, so selection state never drifts by milliseconds or timezone and
 * comparisons are plain lexicographic ordering.
 */

export function toIsoDay(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toISOString().slice(0, 10);
}

export function fromIsoDay(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T00:00:00.000Z`);
}

export function startOfMonthUtc(iso: string): Date {
  const date = fromIsoDay(iso);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export function addMonthsUtc(iso: string, delta: number): Date {
  const date = fromIsoDay(iso);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + delta, 1));
}

export function addDaysUtc(iso: string, delta: number): string {
  const date = fromIsoDay(iso);
  date.setUTCDate(date.getUTCDate() + delta);
  return toIsoDay(date);
}

/** Monday-first, six weeks, so the grid is a fixed height in every month. */
export function buildMonthDays(monthIso: string): string[] {
  const month = startOfMonthUtc(monthIso);
  const offset = (month.getUTCDay() + 6) % 7;
  const start = new Date(month);
  start.setUTCDate(month.getUTCDate() - offset);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    return toIsoDay(date);
  });
}

export const WEEKDAY_SHORT = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"] as const;

export function formatDayLabel(iso: string, options: Intl.DateTimeFormatOptions = {}) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
    ...options,
  }).format(fromIsoDay(iso));
}

export function formatMonthLabel(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(fromIsoDay(iso));
}

export function isWeekend(iso: string) {
  const day = fromIsoDay(iso).getUTCDay();
  return day === 0 || day === 6;
}
