import { NextResponse } from "next/server";

import { getBrand } from "@/data/brands";
import { appendAudit } from "@/lib/repositories/audit-repository";
import { getPost, updatePost } from "@/lib/repositories/posts-repository";
import {
  createScheduleEntry,
  listSchedule,
} from "@/lib/repositories/schedule-repository";
import { schedulingBlocker, validateScheduleTime } from "@/lib/scheduling/rules";

export const dynamic = "force-dynamic";

export async function GET() {
  const entries = await listSchedule();
  return NextResponse.json({ entries });
}

interface ScheduleBody {
  postId?: string;
  scheduledFor?: string;
  igPage?: string;
  approvedBy?: string;
}

/**
 * Books an approved post into a slot.
 *
 * The approval gate lives here and in `schedulingBlocker` — a pending, draft,
 * rejected or already-scheduled post is refused with the reason attached, so
 * no surface can accidentally publish unreviewed work.
 */
export async function POST(request: Request) {
  let body: ScheduleBody;
  try {
    body = (await request.json()) as ScheduleBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { postId, scheduledFor, igPage, approvedBy } = body;
  if (typeof postId !== "string" || postId === "") {
    return NextResponse.json({ error: "postId is required" }, { status: 400 });
  }
  if (typeof scheduledFor !== "string") {
    return NextResponse.json({ error: "scheduledFor is required" }, { status: 400 });
  }

  const post = await getPost(postId);
  if (!post) {
    return NextResponse.json({ error: `No post with id ${postId}` }, { status: 404 });
  }

  const blocker = schedulingBlocker(post.status);
  if (blocker) {
    return NextResponse.json({ error: blocker }, { status: 409 });
  }

  const time = validateScheduleTime(scheduledFor);
  if (!time.ok) {
    return NextResponse.json({ error: time.error }, { status: 400 });
  }

  const brand = getBrand(post.brandId);
  const page =
    typeof igPage === "string" && igPage.trim() !== "" ? igPage.trim() : brand.handle;

  const entry = await createScheduleEntry({
    postId,
    postTitle: post.title,
    brandId: post.brandId,
    igPage: page,
    scheduledFor: time.date.toISOString(),
    approvedBy: approvedBy?.trim() || "Kamal Dhiver",
  });

  await updatePost(postId, { status: "scheduled", scheduledFor: entry.scheduledFor });

  await appendAudit({
    action: "scheduled",
    entityType: "schedule",
    entityId: entry.id,
    postTitle: post.title,
    actor: { name: entry.approvedBy, email: "kamal.dhiver@factory.local" },
    detail: `Scheduled "${post.title}" for ${entry.scheduledFor} on ${page}`,
    changes: [{ field: "status", from: "approved", to: "scheduled" }],
  });

  return NextResponse.json({ entry }, { status: 201 });
}
