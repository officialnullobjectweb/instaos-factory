import { NextResponse } from "next/server";

import { listPosts } from "@/lib/repositories/posts-repository";

export const dynamic = "force-dynamic";

const STALE_HOURS = 12;

/**
 * GET /api/notifications — derived, not stored.
 *
 * Notifications are computed from real state at read time: what is actually
 * waiting for review, what actually failed, what was actually published. There
 * is no notifications table to go stale — dismiss here is client-side only,
 * and the feed is truthful every time it loads.
 */
export async function GET() {
  const posts = await listPosts();
  const now = Date.now();

  const pending = posts
    .filter((post) => post.status === "pending_review")
    .sort(
      (a, b) =>
        new Date(a.generatedAt).getTime() - new Date(b.generatedAt).getTime(),
    );

  const stale = pending.filter(
    (post) =>
      now - new Date(post.generatedAt).getTime() > STALE_HOURS * 3_600_000,
  );

  const failed = posts.filter((post) => post.status === "failed");
  const publishedRecently = posts
    .filter(
      (post) =>
        post.status === "published" &&
        now - new Date(post.updatedAt).getTime() < 24 * 3_600_000,
    )
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );

  const notifications = [] as Array<{
    id: string;
    kind: "review" | "system" | "publish";
    title: string;
    body: string;
    timestamp: string;
    read: boolean;
    brandId: string | null;
  }>;

  if (pending.length > 0) {
    notifications.push({
      id: "ntf-pending",
      kind: "review",
      title: `${pending.length} ${pending.length === 1 ? "post is" : "posts are"} waiting for review`,
      body:
        stale.length > 0
          ? `${stale.length} ${stale.length === 1 ? "has" : "have"} been waiting more than ${STALE_HOURS} hours.`
          : `Oldest: "${pending[0]?.title ?? ""}".`,
      timestamp: pending[0]?.generatedAt ?? new Date().toISOString(),
      read: false,
      brandId: pending[0]?.brandId ?? null,
    });
  }

  for (const post of failed.slice(0, 3)) {
    notifications.push({
      id: `ntf-failed-${post.id}`,
      kind: "system",
      title: `Publish failed — "${post.title}"`,
      body: post.failureReason ?? "The reason was not recorded; retry from the queue.",
      timestamp: post.updatedAt,
      read: false,
      brandId: post.brandId,
    });
  }

  for (const post of publishedRecently.slice(0, 3)) {
    notifications.push({
      id: `ntf-published-${post.id}`,
      kind: "publish",
      title: `"${post.title}" is live`,
      body: "Published to Instagram. Metrics appear after the next insights sync.",
      timestamp: post.updatedAt,
      read: false,
      brandId: post.brandId,
    });
  }

  notifications.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  return NextResponse.json({ notifications });
}
