import { NextResponse } from "next/server";

import { limitOr429 } from "@/lib/security/rate-limit";
import { appendAudit } from "@/lib/repositories/audit-repository";
import {
  getScheduleEntry,
  retryEntry,
} from "@/lib/repositories/schedule-repository";

export const dynamic = "force-dynamic";

interface PublishBody {
  slotId?: string;
}

/**
 * Manual "publish now" for one scheduled slot. Reuses the retry path (which
 * simply re-enters the queue at the front) and lets the next scheduler tick —
 * or an immediate process call — complete it. Duplicate prevention lives in
 * the publish bridge, so double-clicking cannot post twice.
 */
export async function POST(request: Request) {
  // A manual publish re-queues a real Instagram post; a stuck client or a
  // double-click must not be able to hammer the re-queue path.
  const limited = await limitOr429(request, {
    route: "ig-publish",
    name: "ig-publish",
    limit: 5,
    windowSeconds: 60,
  });
  if (limited) return limited;

  let body: PublishBody;
  try {
    body = (await request.json()) as PublishBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.slotId !== "string" || body.slotId === "") {
    return NextResponse.json({ error: "slotId is required" }, { status: 400 });
  }

  const entry = await getScheduleEntry(body.slotId);
  if (!entry) {
    return NextResponse.json({ error: `No slot with id ${body.slotId}` }, { status: 404 });
  }

  if (entry.status !== "failed") {
    return NextResponse.json(
      { error: "Only failed slots can be re-queued" },
      { status: 409 },
    );
  }

  const actor = { name: "Kamal Dhiver", email: "kamal.dhiver@factory.local" };
  const updated = await retryEntry(body.slotId, actor);
  if (!updated) {
    return NextResponse.json({ error: "Could not re-queue the slot" }, { status: 400 });
  }

  await appendAudit({
    action: "retried",
    entityType: "schedule",
    entityId: body.slotId,
    actor,
    detail: "Manual re-queue for publishing",
  });

  return NextResponse.json({ entry: updated });
}
