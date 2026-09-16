import { NextResponse } from "next/server";

import { appendAudit } from "@/lib/repositories/audit-repository";
import { updatePost } from "@/lib/repositories/posts-repository";
import {
  deleteScheduleEntry,
  getScheduleEntry,
  rescheduleEntry,
} from "@/lib/repositories/schedule-repository";
import { validateScheduleTime } from "@/lib/scheduling/rules";

export const dynamic = "force-dynamic";

interface PatchBody {
  scheduledFor?: string;
}

/** Moves a slot to a new time (drag-and-drop or the time picker). */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.scheduledFor !== "string") {
    return NextResponse.json(
      { error: "scheduledFor is required" },
      { status: 400 },
    );
  }

  const existing = await getScheduleEntry(id);
  if (!existing) {
    return NextResponse.json({ error: `No slot with id ${id}` }, { status: 404 });
  }

  const time = validateScheduleTime(body.scheduledFor);
  if (!time.ok) {
    return NextResponse.json({ error: time.error }, { status: 400 });
  }

  const entry = await rescheduleEntry(
    id,
    time.date.toISOString(),
    { name: "Kamal Dhiver", email: "kamal.dhiver@factory.local" },
  );
  if (!entry) {
    return NextResponse.json({ error: `No slot with id ${id}` }, { status: 404 });
  }

  await updatePost(entry.postId, { scheduledFor: entry.scheduledFor });

  return NextResponse.json({ entry });
}

/** Withdraws a slot; the post returns to `approved`. */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  const existing = await getScheduleEntry(id);
  if (!existing) {
    return NextResponse.json({ error: `No slot with id ${id}` }, { status: 404 });
  }

  const deleted = await deleteScheduleEntry(id);
  if (!deleted) {
    return NextResponse.json({ error: `No slot with id ${id}` }, { status: 404 });
  }

  await updatePost(existing.postId, {
    status: "approved",
    scheduledFor: null,
  });

  await appendAudit({
    action: "unscheduled",
    entityType: "schedule",
    entityId: id,
    postTitle: null,
    actor: { name: "Kamal Dhiver", email: "kamal.dhiver@factory.local" },
    detail: `Withdrew slot for ${existing.igPage}`,
  });

  return NextResponse.json({ ok: true });
}
