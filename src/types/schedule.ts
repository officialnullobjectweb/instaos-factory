import type { BrandId } from "./index";

/* -------------------------------------------------------------------------- */
/*  Publishing queue                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Lifecycle of a scheduled slot. `scheduled` waits for its window,
 * `publishing` is mid-flight, `published` and `failed` are terminal for the
 * slot itself (a failed slot can be retried up to the retry cap).
 */
export type PublishingStatus = "scheduled" | "publishing" | "published" | "failed";

export interface PublishAttempt {
  /** ISO timestamp of the attempt. */
  at: string;
  /** Full failure reason; success attempts carry an empty error. */
  error: string;
  ok: boolean;
}

export interface ScheduleEntry {
  id: string;
  postId: string;
  /** Denormalised post title so queue rows render without a join. */
  postTitle: string;
  brandId: BrandId;
  /** Instagram page the post will land on, e.g. "@midnightritual". */
  igPage: string;
  /** ISO — the human-chosen posting time. */
  scheduledFor: string;
  status: PublishingStatus;
  approvedBy: string;
  /** Every publish attempt, oldest first, with the stored failure reason. */
  attempts: PublishAttempt[];
  retryCount: number;
  /** ISO — when the next automatic retry may fire (retry cap permitting). */
  nextRetryAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/* -------------------------------------------------------------------------- */
/*  Audit log                                                                 */
/* -------------------------------------------------------------------------- */

export type AuditAction =
  | "created"
  | "approved"
  | "rejected"
  | "edited"
  | "duplicated"
  | "deleted"
  | "scheduled"
  | "rescheduled"
  | "unscheduled"
  | "published"
  | "publish_failed"
  | "retried";

export interface AuditActor {
  name: string;
  email: string;
}

export interface AuditChange {
  field: string;
  from: string;
  to: string;
}

export interface AuditEntry {
  id: string;
  action: AuditAction;
  entityType: "post" | "schedule";
  entityId: string;
  /** Denormalised for a flat, filterable list. */
  postTitle: string | null;
  actor: AuditActor;
  /** One-line human summary — the primary thing the UI renders. */
  detail: string;
  /** Structured before/after for edit entries. */
  changes: AuditChange[];
  createdAt: string;
}

/* -------------------------------------------------------------------------- */
/*  Telegram control surface                                                  */
/* -------------------------------------------------------------------------- */

export type TelegramCallbackAction = "approve" | "reject";

/** One line in the Telegram activity log (sends, callbacks, errors). */
export interface TelegramLogEntry {
  at: string;
  kind: "notification" | "callback" | "error";
  postId: string | null;
  detail: string;
  ok: boolean;
}

export interface TelegramStatus {
  configured: boolean;
  chatId: string | null;
  /** Present when the bot was pinged recently, so the UI can show liveness. */
  lastMessageAt: string | null;
  lastError: string | null;
}
