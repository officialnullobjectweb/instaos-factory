import {
  publishMedia,
  GraphApiError,
  type PublishInput,
} from "@/lib/instagram/graph-client";
import {
  slideImageUrl,
  storeCleanSlideImages,
} from "@/lib/instagram/media";
import {
  findAccountByHandle,
  setAccountStatus,
} from "@/lib/repositories/instagram-accounts-repository";
import {
  findByPostId,
  recordPublish,
} from "@/lib/repositories/instagram-history-repository";
import { getPost } from "@/lib/repositories/posts-repository";
import type { PublishAttempt, ScheduleEntry } from "@/types";

/**
 * The bridge between the scheduling engine and the Instagram Graph API.
 *
 * `processDueEntries` calls `publishScheduledPost` for each due slot; this
 * module renders the post's slides, strips metadata, publishes through the
 * official API and records the history entry. When no account is configured for
 * the slot's page the slot completes in local mode so the whole pipeline stays
 * testable without credentials.
 */
export { slideImageUrl };

/*
 * Rendering, metadata cleaning and the public slide URL live in
 * `lib/instagram/media.ts`. They are shared with the route that serves slide
 * images to Instagram's crawler, which has to render a single slide on demand
 * and so cannot use this module's whole-deck flow.
 */

export interface PublishSlotOutcome {
  attempt: PublishAttempt;
  /** Set when the slot completed in local mode (no account configured). */
  localMode: boolean;
  /** Set when publishing was skipped because the post is already live. */
  duplicate?: boolean;
}

/**
 * Publishes one due slot. Every failure mode from the prompt is handled:
 * expired tokens (account flips to `token_expired`), rate limits and upload
 * failures (stored as the attempt error, so the scheduler's retry policy
 * takes over), and duplicate publishes (short-circuited from history).
 */
export async function publishScheduledPost(
  entry: ScheduleEntry,
): Promise<PublishSlotOutcome> {
  const at = new Date().toISOString();

  const post = await getPost(entry.postId);
  if (!post) {
    return {
      attempt: { at, error: `Post ${entry.postId} no longer exists`, ok: false },
      localMode: false,
    };
  }

  // ---- Duplicate prevention -------------------------------------------------
  const existing = await findByPostId(post.id);
  if (existing || post.status === "published") {
    return {
      attempt: {
        at,
        error: "",
        ok: true,
      },
      localMode: false,
      duplicate: true,
    };
  }

  const account = await findAccountByHandle(entry.igPage);

  // ---- Local mode: nothing configured, complete the slot honestly ----------
  if (!account) {
    return { attempt: { at, error: "", ok: true }, localMode: true };
  }

  if (account.status === "token_expired") {
    return {
      attempt: {
        at,
        error: "Access token expired — reconnect the account in Settings → Instagram",
        ok: false,
      },
      localMode: false,
    };
  }

  // ---- Real publish ---------------------------------------------------------
  try {
    const stored = await storeCleanSlideImages(post);
    const input: PublishInput = {
      igUserId: account.igUserId,
      accessToken: account.accessToken,
      imageUrls: Array.from({ length: stored.count }, (_, index) =>
        slideImageUrl(post.id, index + 1),
      ),
      caption: post.caption,
      isReel: post.format === "reel",
    };

    const result = await publishMedia(input);

    if (!result.ok || !result.mediaId) {
      if (result.errorKind === "expired_token") {
        await setAccountStatus(
          account.id,
          "token_expired",
          result.error ?? "Token expired",
        );
      }
      return {
        attempt: { at, error: result.error ?? "Publish failed", ok: false },
        localMode: false,
      };
    }

    await recordPublish({
      postId: post.id,
      postTitle: post.title,
      accountId: account.id,
      igUserId: account.igUserId,
      handle: account.handle,
      brandId: post.brandId,
      mediaKind:
        post.format === "reel" ? "reel" : stored.count > 1 ? "carousel" : "single",
      mediaId: result.mediaId,
      permalink: result.permalink ?? "",
      elapsedMs: Date.now() - new Date(at).getTime(),
      attempt: entry.retryCount + 1,
    });

    return { attempt: { at, error: "", ok: true }, localMode: false };
  } catch (error) {
    const message =
      error instanceof GraphApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Unknown publish error";

    if (error instanceof GraphApiError && error.kind === "expired_token") {
      await setAccountStatus(account.id, "token_expired", message);
    }

    return { attempt: { at, error: message, ok: false }, localMode: false };
  }
}
