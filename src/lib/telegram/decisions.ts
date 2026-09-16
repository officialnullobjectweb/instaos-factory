import { getPost, updatePost } from "@/lib/repositories/posts-repository";
import { unschedulePost } from "@/lib/repositories/schedule-repository";
import { appendAudit } from "@/lib/repositories/audit-repository";
import type { AuditActor, TelegramCallbackAction } from "@/types";

/**
 * The one implementation of "a human decided". The dashboard PATCH route and
 * the Telegram callback route both land here, so a post can never be approved
 * in one surface and logged differently in the other.
 */
export async function applyTelegramDecision(
  action: TelegramCallbackAction,
  postId: string,
  actor: AuditActor,
): Promise<{ ok: boolean; applied: boolean; error?: string }> {
  const post = await getPost(postId);
  if (!post) return { ok: false, applied: false, error: "Post not found" };

  if (action === "approve") {
    if (post.status !== "pending_review" && post.status !== "rejected") {
      return { ok: true, applied: false, error: "Post is not awaiting review" };
    }

    const updated = await updatePost(postId, {
      status: "approved",
      note: undefined,
      failureReason: null,
    });
    if (!updated) return { ok: false, applied: false, error: "Update failed" };

    await appendAudit({
      action: "approved",
      entityType: "post",
      entityId: postId,
      postTitle: post.title,
      actor,
      detail: "Approved via Telegram",
    });
    return { ok: true, applied: true };
  }

  // Reject: also pulls the post out of any pending slot.
  if (post.status !== "pending_review" && post.status !== "approved" && post.status !== "scheduled") {
    return { ok: true, applied: false, error: "Post is not in a rejectable state" };
  }

  const updated = await updatePost(postId, {
    status: "rejected",
    note: "Rejected via Telegram",
    failureReason: null,
  });
  if (!updated) return { ok: false, applied: false, error: "Update failed" };

  await unschedulePost(postId);
  await appendAudit({
    action: "rejected",
    entityType: "post",
    entityId: postId,
    postTitle: post.title,
    actor,
    detail: "Rejected via Telegram",
  });
  return { ok: true, applied: true };
}
