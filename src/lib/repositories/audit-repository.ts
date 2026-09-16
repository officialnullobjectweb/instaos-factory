import { randomUUID } from "node:crypto";

import { arrayDocument } from "@/lib/storage";
import type { AuditAction, AuditActor, AuditEntry } from "@/types";

/**
 * Append-mostly log of every approval, rejection, edit and publish event.
 *
 * The storage mechanics — caching, write serialisation, the seed fallback —
 * live in the shared document layer. What belongs here is the shape of an audit
 * entry, the query surface, and the cap that keeps the log bounded.
 */

const MAX_ENTRIES = 800;

/**
 * Guards entries read back from the store.
 *
 * The log is written by this app, but it is also the file a human opens when
 * something looks wrong, and it is served from a store that can be edited by
 * hand. A row missing its `actor` would crash the audit list while rendering,
 * so unusable rows are dropped at the boundary instead of trusted.
 */
function isAuditEntry(raw: unknown): raw is AuditEntry {
  if (typeof raw !== "object" || raw === null) return false;
  const entry = raw as Partial<AuditEntry>;

  return (
    typeof entry.id === "string" &&
    typeof entry.action === "string" &&
    typeof entry.detail === "string" &&
    typeof entry.createdAt === "string" &&
    typeof entry.actor === "object" &&
    entry.actor !== null &&
    typeof entry.actor.email === "string"
  );
}

const audit = () =>
  arrayDocument<AuditEntry>({
    key: "audit",
    isItem: isAuditEntry,
    maxItems: MAX_ENTRIES,
  });

export interface AuditInput {
  action: AuditAction;
  entityType: AuditEntry["entityType"];
  entityId: string;
  postTitle?: string | null;
  actor: AuditActor;
  detail: string;
  changes?: AuditEntry["changes"];
}

/**
 * Appends one entry.
 *
 * Failures are swallowed: an audit write must never break the action it is
 * recording. A rejected approval that *did* happen, but reported an error
 * because the log could not be written, is worse than a gap in the log.
 */
export async function appendAudit(input: AuditInput): Promise<void> {
  const entry: AuditEntry = {
    id: `audit-${randomUUID().slice(0, 12)}`,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    postTitle: input.postTitle ?? null,
    actor: input.actor,
    detail: input.detail,
    changes: input.changes ?? [],
    createdAt: new Date().toISOString(),
  };

  try {
    await audit().prepend(entry);
  } catch {
    // Intentionally ignored — see above.
  }
}

export interface AuditQuery {
  actions?: AuditAction[];
  entityType?: AuditEntry["entityType"];
  entityId?: string;
  actorEmail?: string;
  search?: string;
  limit?: number;
}

export async function listAudit(query: AuditQuery = {}): Promise<AuditEntry[]> {
  const entries = await audit().read();
  const search = query.search?.trim().toLowerCase();

  const filtered = entries.filter((entry) => {
    if (query.actions && !query.actions.includes(entry.action)) return false;
    if (query.entityType && entry.entityType !== query.entityType) return false;
    if (query.entityId && entry.entityId !== query.entityId) return false;
    if (query.actorEmail && entry.actor.email !== query.actorEmail) return false;
    if (search) {
      const haystack =
        `${entry.detail} ${entry.postTitle ?? ""} ${entry.actor.name} ${entry.action}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });

  return query.limit ? filtered.slice(0, query.limit) : filtered;
}

/** Absolute count for UI badges without shipping every entry to the client. */
export async function countAudit(): Promise<number> {
  return (await audit().read()).length;
}

/** Used by the reset script to empty the log. */
export async function replaceAllAudit(entries: AuditEntry[]): Promise<AuditEntry[]> {
  return audit().replaceAll(entries);
}
