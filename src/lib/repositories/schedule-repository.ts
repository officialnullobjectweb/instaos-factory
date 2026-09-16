import { randomUUID } from "node:crypto";

import { appendAudit } from "@/lib/repositories/audit-repository";
import { updatePost } from "@/lib/repositories/posts-repository";
import { arrayDocument } from "@/lib/storage";
import { MAX_RETRIES, nextRetryAt } from "@/lib/scheduling/rules";
import type { AuditActor, PublishAttempt, ScheduleEntry } from "@/types";

/**
 * The schedule document, plus the publish engine that turns due slots into
 * published posts (or recorded failures).
 *
 * Publishing goes through the official Instagram Graph API via
 * `lib/instagram/publish.ts`; with no account connected the bridge completes
 * the slot in local mode, so the pipeline still runs end to end without
 * credentials.
 */

function isScheduleEntry(raw: unknown): raw is ScheduleEntry {
  if (typeof raw !== "object" || raw === null) return false;
  const entry = raw as Partial<ScheduleEntry>;

  return (
    typeof entry.id === "string" &&
    typeof entry.postId === "string" &&
    typeof entry.scheduledFor === "string" &&
    typeof entry.status === "string" &&
    Array.isArray(entry.attempts) &&
    typeof entry.retryCount === "number"
  );
}

const schedule = () =>
  arrayDocument<ScheduleEntry>({
    key: "schedule",
    isItem: isScheduleEntry,
  });

/** The service identity used for machine-made audit entries. */
const SCHEDULER_ACTOR: AuditActor = {
  name: "Scheduler",
  email: "scheduler@factory.local",
};

function isActive(entry: ScheduleEntry): boolean {
  return entry.status === "scheduled" || entry.status === "publishing";
}

/* -------------------------------------------------------------------------- */
/*  Reads                                                                     */
/* -------------------------------------------------------------------------- */

export async function listSchedule(): Promise<ScheduleEntry[]> {
  const entries = await schedule().read();
  return entries.map((entry) => ({ ...entry }));
}

export async function getScheduleEntry(id: string): Promise<ScheduleEntry | null> {
  const entries = await schedule().read();
  const entry = entries.find((candidate) => candidate.id === id);
  return entry ? { ...entry } : null;
}

export async function findEntryForPost(
  postId: string,
): Promise<ScheduleEntry | null> {
  const entries = await schedule().read();
  const entry = entries.find(
    (candidate) => candidate.postId === postId && isActive(candidate),
  );
  return entry ? { ...entry } : null;
}

/* -------------------------------------------------------------------------- */
/*  Mutations                                                                 */
/* -------------------------------------------------------------------------- */

export interface CreateEntryInput {
  postId: string;
  postTitle: string;
  brandId: ScheduleEntry["brandId"];
  igPage: string;
  scheduledFor: string;
  approvedBy: string;
}

export async function createScheduleEntry(
  input: CreateEntryInput,
): Promise<ScheduleEntry> {
  const now = new Date().toISOString();
  const entry: ScheduleEntry = {
    id: `slot-${randomUUID().slice(0, 12)}`,
    postId: input.postId,
    postTitle: input.postTitle,
    brandId: input.brandId,
    igPage: input.igPage,
    scheduledFor: input.scheduledFor,
    status: "scheduled",
    approvedBy: input.approvedBy,
    attempts: [],
    retryCount: 0,
    nextRetryAt: null,
    publishedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  const next = await schedule().mutate((current) => [entry, ...current]);
  // The entry we just prepended, by identity rather than by index, so a retry
  // under contention still returns the right slot.
  return next.find((candidate) => candidate.id === entry.id) ?? entry;
}

export async function deleteScheduleEntry(id: string): Promise<boolean> {
  let removed = false;

  await schedule().mutate((current) => {
    const filtered = current.filter((entry) => entry.id !== id);
    if (filtered.length === current.length) return current;
    removed = true;
    return filtered;
  });

  return removed;
}

/** Pulls a post back out of the pipeline (used by reject/withdraw flows). */
export async function unschedulePost(postId: string): Promise<boolean> {
  let removed = false;

  await schedule().mutate((current) => {
    const filtered = current.filter(
      (entry) => !(entry.postId === postId && isActive(entry)),
    );
    if (filtered.length === current.length) return current;
    removed = true;
    return filtered;
  });

  return removed;
}

export async function rescheduleEntry(
  id: string,
  scheduledFor: string,
  actor: AuditActor,
): Promise<ScheduleEntry | null> {
  let previous: string | null = null;

  await schedule().mutate((current) => {
    const index = current.findIndex((entry) => entry.id === id);
    if (index === -1) return current;

    previous = current[index].scheduledFor;
    const updated = [...current];
    updated[index] = {
      ...current[index],
      scheduledFor,
      status: "scheduled",
      updatedAt: new Date().toISOString(),
    };
    return updated;
  });

  if (previous === null) return null;

  await appendAudit({
    action: "rescheduled",
    entityType: "schedule",
    entityId: id,
    postTitle: null,
    actor,
    detail: `Rescheduled slot to ${scheduledFor}`,
    changes: [{ field: "scheduledFor", from: previous, to: scheduledFor }],
  });

  return getScheduleEntry(id);
}

export async function retryEntry(
  id: string,
  actor: AuditActor,
): Promise<ScheduleEntry | null> {
  let attempt = 0;

  await schedule().mutate((current) => {
    const index = current.findIndex((entry) => entry.id === id);
    if (index === -1) return current;

    const entry = current[index];
    // Only a failed slot that has not exhausted the cap may be retried.
    if (entry.status !== "failed" || entry.retryCount >= MAX_RETRIES) return current;

    attempt = entry.retryCount + 1;
    const updated = [...current];
    updated[index] = {
      ...entry,
      status: "scheduled",
      nextRetryAt: null,
      updatedAt: new Date().toISOString(),
    };
    return updated;
  });

  if (attempt === 0) return getScheduleEntry(id);

  await appendAudit({
    action: "retried",
    entityType: "schedule",
    entityId: id,
    actor,
    detail: `Retry requested (attempt ${attempt} of ${MAX_RETRIES})`,
  });

  return getScheduleEntry(id);
}

/* -------------------------------------------------------------------------- */
/*  Publish engine                                                            */
/* -------------------------------------------------------------------------- */

type PublishFn = (
  entry: ScheduleEntry,
) => Promise<import("@/lib/instagram/publish").PublishSlotOutcome>;

/**
 * Injectable publish transport. Defaults to the real Instagram bridge, which
 * completes the slot in local mode when no account is configured.
 */
let publishImplementation: PublishFn = async (entry) => {
  const { publishScheduledPost } = await import("@/lib/instagram/publish");
  return publishScheduledPost(entry);
};

/** Registers the transport used by `processDueEntries` (called at boot). */
export function setPublishImplementation(fn: PublishFn) {
  publishImplementation = fn;
}

async function attemptPublish(entry: ScheduleEntry): Promise<PublishAttempt> {
  const outcome = await publishImplementation(entry);
  // Local mode and duplicates complete the slot successfully; only a real
  // failure returns ok:false and enters the retry policy.
  if (outcome.duplicate) {
    return { ...outcome.attempt, ok: true };
  }
  return outcome.attempt;
}

export interface ProcessResult {
  processed: number;
  published: number;
  failed: number;
}

function isDue(entry: ScheduleEntry, now: Date): boolean {
  if (entry.status !== "scheduled") return false;
  if (new Date(entry.scheduledFor).getTime() <= now.getTime()) return true;
  return (
    entry.nextRetryAt !== null &&
    new Date(entry.nextRetryAt).getTime() <= now.getTime()
  );
}

/**
 * Runs one scheduler tick.
 *
 * Due slots are marked publishing, attempted, and then either published or
 * recorded as a failure with the next retry scheduled inside the cap.
 * Idempotent and safe to run from cron or the dashboard's manual trigger.
 *
 * **The publish itself happens outside the document's write lock**, which is a
 * change from how this used to work and the important one. Holding a lock
 * across a network call to Instagram would serialise every other write in the
 * app behind it for the length of an upload, and — worse — the document layer
 * retries conflicting mutations, so a mutation containing the publish could run
 * twice and post the same carousel twice. Split into mark → publish → record,
 * the retryable parts are pure and the non-idempotent part happens exactly once
 * per entry, guarded by the `publishing` status that is durable before the
 * attempt starts.
 */
export async function processDueEntries(
  now: Date = new Date(),
): Promise<ProcessResult> {
  const nowIso = now.toISOString();
  const entries = await schedule().read({ fresh: true });
  const due = entries.filter((entry) => isDue(entry, now));

  if (due.length === 0) return { processed: 0, published: 0, failed: 0 };

  // Mark each slot publishing before touching the network, so a crash mid-flight
  // leaves a visible state rather than a slot that looks untouched.
  await schedule().mutate((current) =>
    current.map((entry) =>
      due.some((candidate) => candidate.id === entry.id)
        ? { ...entry, status: "publishing" as const, updatedAt: nowIso }
        : entry,
    ),
  );

  const outcomes: Array<{ id: string; attempt: PublishAttempt }> = [];
  for (const entry of due) {
    outcomes.push({ id: entry.id, attempt: await attemptPublish(entry) });
  }

  // One write for the whole tick, derived only from the outcomes and the
  // current document, so re-applying it after a conflict is safe.
  const updated = await schedule().mutate((current) =>
    current.map((entry) => {
      const outcome = outcomes.find((candidate) => candidate.id === entry.id);
      if (!outcome) return entry;

      const attempt = outcome.attempt;
      const attempts = [...entry.attempts, attempt];

      if (attempt.ok) {
        return {
          ...entry,
          status: "published" as const,
          attempts,
          publishedAt: attempt.at,
          nextRetryAt: null,
          updatedAt: attempt.at,
        };
      }

      /* Three attempts total, 15 minutes apart. The attempt that breaches the
         cap marks the slot failed. */
      const retryCount = entry.retryCount + 1;
      const exhausted = retryCount >= MAX_RETRIES;

      return {
        ...entry,
        status: exhausted ? ("failed" as const) : ("scheduled" as const),
        attempts,
        retryCount,
        nextRetryAt: exhausted ? null : nextRetryAt(retryCount, now),
        updatedAt: attempt.at,
      };
    }),
  );

  let published = 0;
  let failed = 0;

  // Side effects after the slot states are durable. Derived from `updated`
  // rather than from the mutation's closure, so a retry cannot double-record.
  for (const outcome of outcomes) {
    const entry = updated.find((candidate) => candidate.id === outcome.id);
    if (!entry) continue;

    if (outcome.attempt.ok) {
      published += 1;
      await updatePost(entry.postId, {
        status: "published",
        publishedAt: outcome.attempt.at,
      });
      await appendAudit({
        action: "published",
        entityType: "schedule",
        entityId: entry.id,
        actor: SCHEDULER_ACTOR,
        detail: `Published to ${entry.igPage}`,
      });
      continue;
    }

    failed += 1;
    const exhausted = entry.status === "failed";
    const reason = outcome.attempt.error || "Unknown publish error";

    await appendAudit({
      action: "publish_failed",
      entityType: "schedule",
      entityId: entry.id,
      actor: SCHEDULER_ACTOR,
      detail: exhausted
        ? `Publish failed after ${MAX_RETRIES} attempts: ${reason}`
        : `Publish failed (attempt ${entry.retryCount}/${MAX_RETRIES}), retry in 15 min: ${reason}`,
    });

    if (exhausted) {
      await updatePost(entry.postId, {
        status: "failed",
        failureReason: reason,
      });
    }
  }

  return { processed: due.length, published, failed };
}

/** Backfill helper for seed scripts — never called from UI code. */
export async function replaceAllSchedule(
  entries: ScheduleEntry[],
): Promise<ScheduleEntry[]> {
  return schedule().replaceAll(entries);
}
