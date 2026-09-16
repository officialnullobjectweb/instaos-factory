import { listAudit } from "@/lib/repositories/audit-repository";
import { listSchedule } from "@/lib/repositories/schedule-repository";
import { NextResponse } from "next/server";

import type { ActivityEvent } from "@/types";

export const dynamic = "force-dynamic";

/**
 * Maps an audit action onto the activity kinds the timeline renders.
 */
const ACTION_KIND: Record<string, ActivityEvent["kind"]> = {
  created: "generation",
  approved: "approval",
  rejected: "rejection",
  edited: "comment",
  duplicated: "generation",
  deleted: "system",
  scheduled: "schedule",
  rescheduled: "schedule",
  unscheduled: "schedule",
  published: "publish",
  publish_failed: "failure",
  retried: "system",
};

/**
 * Derives a brand id from the entity id when the audit entry does not carry
 * one — post ids are stable, so the timeline groups by the same key the queue
 * uses. Brand attribution lives in the entry's detail text only, so this reads
 * the queue when it can.
 */
async function brandForEntity(entityType: string, entityId: string): Promise<string | null> {
  if (entityType !== "post") return null;
  try {
    const { getPost } = await import("@/lib/repositories/posts-repository");
    const post = await getPost(entityId);
    return post?.brandId ?? null;
  } catch {
    return null;
  }
}

/**
 * GET /api/activity — the dashboard's recent-activity trail.
 *
 * Derived entirely from the audit log: every approval, rejection, edit and
 * publish the system actually performed, newest first. There is no separate
 * activity store — the audit log is the single source of truth, so the
 * timeline can never show an event that did not happen.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 20) || 20, 100);

  const [entries, schedule] = await Promise.all([
    listAudit({ limit }),
    listSchedule().catch(() => []),
  ]);
  const scheduledByPost = new Map(schedule.map((entry) => [entry.postId, entry]));

  const events: ActivityEvent[] = [];
  for (const entry of entries) {
    const brandId = await brandForEntity(entry.entityType, entry.entityId);
    const kind = ACTION_KIND[entry.action] ?? "system";
    const scheduleEntry =
      entry.entityType === "post" ? scheduledByPost.get(entry.entityId) : undefined;
    const timing = scheduleEntry?.scheduledFor
      ? ` for ${new Date(scheduleEntry.scheduledFor).toUTCString().slice(0, 22)}`
      : "";

    events.push({
      id: entry.id,
      kind,
      actor: entry.actor.name,
      brandId: (brandId as ActivityEvent["brandId"]) ?? null,
      message: entry.postTitle
        ? `${verbFor(entry.action)} "${entry.postTitle}"${timing}`
        : entry.detail,
      targetId: entry.entityId,
      timestamp: entry.createdAt,
    });
  }

  return NextResponse.json({ events });
}

function verbFor(action: string): string {
  switch (action) {
    case "created":
      return "Generated";
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    case "edited":
      return "Edited";
    case "duplicated":
      return "Duplicated";
    case "deleted":
      return "Deleted";
    case "scheduled":
      return "Scheduled";
    case "rescheduled":
      return "Rescheduled";
    case "unscheduled":
      return "Unscheduled";
    case "published":
      return "Published";
    case "publish_failed":
      return "Failed to publish";
    case "retried":
      return "Retried";
    default:
      return action;
  }
}
