import type { ContentStatus } from "@/types";

/**
 * The approval gate, in one place. Only work a human has approved may enter
 * the publishing pipeline — every scheduling entry point funnels through here
 * so the rule cannot drift between the drawer, the dialog and the API.
 */
export function schedulingBlocker(status: ContentStatus): string | null {
  switch (status) {
    case "approved":
      return null;
    case "pending_review":
      return "Pending posts need review before they can be scheduled.";
    case "draft":
      return "Drafts need to be submitted for review first.";
    case "rejected":
      return "Rejected posts must be regenerated before scheduling.";
    case "scheduled":
      return "This post is already scheduled.";
    case "published":
      return "This post has already been published.";
    case "failed":
      return "A failed publish is retried from the publishing queue, not rescheduled.";
  }
}

/** Hard cap on how far out a slot may be booked. */
export const MAX_SCHEDULE_DAYS_AHEAD = 90;

/** The retry policy: at most 3 retries, 15 minutes apart. */
export const MAX_RETRIES = 3;
export const RETRY_DELAY_MINUTES = 15;

export function validateScheduleTime(
  iso: string,
  now: Date = new Date(),
): { ok: true; date: Date } | { ok: false; error: string } {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return { ok: false, error: "That time could not be parsed." };
  }

  // One minute of grace absorbs clock skew between client and server.
  const earliest = now.getTime() - 60_000;
  if (date.getTime() < earliest) {
    return { ok: false, error: "Choose a time in the future." };
  }

  const latest = now.getTime() + MAX_SCHEDULE_DAYS_AHEAD * 24 * 60 * 60_000;
  if (date.getTime() > latest) {
    return {
      ok: false,
      error: `Pick a slot within the next ${MAX_SCHEDULE_DAYS_AHEAD} days.`,
    };
  }

  return { ok: true, date };
}

/** When the next automatic retry may fire — null once the cap is spent. */
export function nextRetryAt(retryCount: number, now: Date = new Date()): string | null {
  if (retryCount >= MAX_RETRIES) return null;
  return new Date(now.getTime() + RETRY_DELAY_MINUTES * 60_000).toISOString();
}
