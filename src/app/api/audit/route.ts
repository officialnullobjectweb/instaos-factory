import { NextResponse } from "next/server";

import { listAudit, type AuditQuery } from "@/lib/repositories/audit-repository";
import type { AuditAction } from "@/types";

export const dynamic = "force-dynamic";

const VALID_ACTIONS: AuditAction[] = [
  "created",
  "approved",
  "rejected",
  "edited",
  "duplicated",
  "deleted",
  "scheduled",
  "rescheduled",
  "unscheduled",
  "published",
  "publish_failed",
  "retried",
];

export async function GET(request: Request) {
  const url = new URL(request.url);
  const actionsParam = url.searchParams.getAll("action");

  const actions = actionsParam.filter((action): action is AuditAction =>
    (VALID_ACTIONS as string[]).includes(action),
  );

  const query: AuditQuery = {
    ...(actions.length > 0 ? { actions } : {}),
    ...(url.searchParams.get("entityType") === "post" ||
    url.searchParams.get("entityType") === "schedule"
      ? { entityType: url.searchParams.get("entityType") as AuditQuery["entityType"] }
      : {}),
    ...(url.searchParams.get("entityId")
      ? { entityId: url.searchParams.get("entityId") as string }
      : {}),
    ...(url.searchParams.get("q")
      ? { search: url.searchParams.get("q") as string }
      : {}),
    limit: Math.min(Number(url.searchParams.get("limit") ?? 200) || 200, 500),
  };

  const entries = await listAudit(query);
  return NextResponse.json({ entries });
}
