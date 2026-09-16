/**
 * Mock data is anchored to a fixed instant so server and client renders agree
 * (relative labels such as "2h ago" stay deterministic and hydration-safe).
 */
export const MOCK_NOW_ISO = "2026-09-15T14:20:00.000Z";

export const MOCK_NOW = new Date(MOCK_NOW_ISO);

export function minutesAgo(minutes: number) {
  return new Date(MOCK_NOW.getTime() - minutes * 60_000).toISOString();
}

export function hoursAgo(hours: number) {
  return minutesAgo(hours * 60);
}

export function daysAgo(days: number, hour = 9, minute = 30) {
  const date = new Date(MOCK_NOW);
  date.setUTCDate(date.getUTCDate() - days);
  date.setUTCHours(hour, minute, 0, 0);
  return date.toISOString();
}

export function daysFromNow(days: number, hour = 9, minute = 30) {
  return daysAgo(-days, hour, minute);
}
