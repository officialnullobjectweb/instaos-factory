import { MOCK_NOW } from "@/data/time";
import type { ContentItem, ContentStatus } from "@/types";

const DAY_MS = 86_400_000;

export function isSameUtcDay(iso: string, reference: Date = MOCK_NOW) {
  const date = new Date(iso);
  return (
    date.getUTCFullYear() === reference.getUTCFullYear() &&
    date.getUTCMonth() === reference.getUTCMonth() &&
    date.getUTCDate() === reference.getUTCDate()
  );
}

export function countByStatus(items: ContentItem[], status: ContentStatus) {
  return items.filter((item) => item.status === status).length;
}

/** Items published on the anchor day — powers the "Published Today" widget. */
export function countPublishedToday(items: ContentItem[]) {
  return items.filter(
    (item) =>
      item.status === "published" &&
      item.scheduledFor !== null &&
      isSameUtcDay(item.scheduledFor),
  ).length;
}

/** Approved items that still need a slot, so the dashboard can nudge the planner. */
export function countAwaitingSlot(items: ContentItem[]) {
  return items.filter(
    (item) => item.status === "approved" && item.scheduledFor === null,
  ).length;
}

export function upcomingScheduled(items: ContentItem[], limit = 4) {
  const now = MOCK_NOW.getTime();
  return items
    .filter(
      (item) =>
        item.status === "scheduled" &&
        item.scheduledFor !== null &&
        new Date(item.scheduledFor).getTime() >= now - DAY_MS,
    )
    .sort(
      (a, b) =>
        new Date(a.scheduledFor ?? 0).getTime() -
        new Date(b.scheduledFor ?? 0).getTime(),
    )
    .slice(0, limit);
}

export interface QueueSummary {
  /** Items waiting on a human decision — the number that matters most. */
  pendingReview: number;
  approved: number;
  scheduled: number;
  publishedToday: number;
  awaitingSlot: number;
  failed: number;
  rejected: number;
  drafts: number;
  total: number;
}

export function summariseQueue(items: ContentItem[]): QueueSummary {
  return {
    pendingReview: countByStatus(items, "pending_review"),
    approved: countByStatus(items, "approved"),
    scheduled: countByStatus(items, "scheduled"),
    publishedToday: countPublishedToday(items),
    awaitingSlot: countAwaitingSlot(items),
    failed: countByStatus(items, "failed"),
    rejected: countByStatus(items, "rejected"),
    drafts: countByStatus(items, "draft"),
    total: items.length,
  };
}

/** Average quality score across a set of posts, used by the queue header. */
export function averageQuality(items: Array<{ quality: { score: number } }>) {
  if (items.length === 0) return 0;
  const total = items.reduce((sum, item) => sum + item.quality.score, 0);
  return Math.round(total / items.length);
}

/** Reach/engagement delta rendered next to metric values. */
export function percentChange(value: number, previous: number) {
  if (previous === 0) return 0;
  return ((value - previous) / previous) * 100;
}
