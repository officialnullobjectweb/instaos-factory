import { NextResponse } from "next/server";

import {
  regenerateCaption,
  regenerateCarousel,
  type RegenerationResult,
} from "@/lib/posts/generator";
import {
  appendAudit,
} from "@/lib/repositories/audit-repository";
import {
  deletePost,
  getPost,
  updatePost,
  type UpdatePostOptions,
} from "@/lib/repositories/posts-repository";
import { unschedulePost } from "@/lib/repositories/schedule-repository";
import { notifyPostPending } from "@/lib/telegram";
import type { AuditActor, ContentStatus, Post, PostEditableField, Slide } from "@/types";

export const dynamic = "force-dynamic";

type PostAction =
  | "approve"
  | "reject"
  | "reopen"
  | "retry_publish"
  | "regenerate_caption"
  | "regenerate_carousel";

interface PatchBody {
  action?: PostAction;
  note?: string;
  author?: string;
  fields?: Partial<Pick<Post, PostEditableField>>;
  commit?: { summary?: string; author?: string };
}

const DEFAULT_AUTHOR = "Kamal Dhiver";

function actorFor(name: string): AuditActor {
  return {
    name,
    email: `${name.toLowerCase().replace(/[^a-z]+/g, ".")}@factory.local`,
  };
}

/** Compact before/after rendering for the audit log's change rows. */
function describeValue(value: unknown): string {
  if (value === undefined || value === null) return "—";
  if (Array.isArray(value)) return `${value.length} item${value.length === 1 ? "" : "s"}`;
  const text = String(value);
  return text.length > 80 ? `${text.slice(0, 77)}…` : text;
}

const STATUS_BY_ACTION: Partial<Record<PostAction, ContentStatus>> = {
  approve: "approved",
  reject: "rejected",
  reopen: "pending_review",
  retry_publish: "scheduled",
};

function nextSlot() {
  const slot = new Date(Date.now() + 60 * 60 * 1000);
  slot.setUTCMinutes(30, 0, 0);
  return slot.toISOString();
}

/** Rejects anything that is not one of the editable fields, with a reason. */
function readFields(input: unknown): Partial<Pick<Post, PostEditableField>> {
  if (input === undefined) return {};
  if (typeof input !== "object" || input === null) {
    throw new Error("`fields` must be an object");
  }

  const source = input as Record<string, unknown>;
  const fields: Partial<Pick<Post, PostEditableField>> = {};

  if (source.title !== undefined) {
    if (typeof source.title !== "string" || source.title.trim() === "") {
      throw new Error("`fields.title` must be a non-empty string");
    }
    fields.title = source.title.trim().slice(0, 160);
  }

  if (source.caption !== undefined) {
    if (typeof source.caption !== "string") {
      throw new Error("`fields.caption` must be a string");
    }
    fields.caption = source.caption.slice(0, 4000);
  }

  if (source.altText !== undefined) {
    if (typeof source.altText !== "string") {
      throw new Error("`fields.altText` must be a string");
    }
    fields.altText = source.altText.slice(0, 1000);
  }

  if (source.hashtags !== undefined) {
    if (
      !Array.isArray(source.hashtags) ||
      source.hashtags.some((tag) => typeof tag !== "string")
    ) {
      throw new Error("`fields.hashtags` must be an array of strings");
    }
    fields.hashtags = (source.hashtags as string[])
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0)
      .map((tag) => (tag.startsWith("#") ? tag : `#${tag}`))
      .slice(0, 30);
  }

  if (source.slides !== undefined) {
    if (!Array.isArray(source.slides)) {
      throw new Error("`fields.slides` must be an array");
    }
    fields.slides = (source.slides as Slide[]).map((slide, index) => {
      if (!slide || typeof slide.headline !== "string") {
        throw new Error(`\`fields.slides[${index}].headline\` is required`);
      }
      return {
        id: slide.id ?? `${index + 1}`,
        index,
        kind: slide.kind ?? "statement",
        kicker: slide.kicker ?? "",
        headline: slide.headline,
        body: slide.body ?? "",
        footnote: slide.footnote,
      };
    });
  }

  return fields;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const post = await getPost(id);

  if (!post) {
    return NextResponse.json({ error: `No post with id ${id}` }, { status: 404 });
  }

  return NextResponse.json({ post });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  try {
    const body = (await request.json()) as PatchBody;
    const current = await getPost(id);

    if (!current) {
      return NextResponse.json({ error: `No post with id ${id}` }, { status: 404 });
    }

    const author = body.author ?? body.commit?.author ?? DEFAULT_AUTHOR;
    const options: UpdatePostOptions = {};

    if (body.fields) {
      options.fields = readFields(body.fields);
    }

    if (body.action) {
      const status = STATUS_BY_ACTION[body.action];

      if (status) {
        options.status = status;

        if (body.action === "reject") {
          options.note =
            body.note?.trim() || "Sent back without a note. Add one next time.";
          options.scheduledFor = null;
        }

        if (body.action === "approve" || body.action === "reopen") {
          options.note = undefined;
        }

        if (body.action === "reopen") {
          options.failureReason = null;
        }

        if (body.action === "retry_publish") {
          options.failureReason = null;
          options.scheduledFor = nextSlot();
          options.retryCount = current.retryCount + 1;
        }
      }

      if (
        body.action === "regenerate_caption" ||
        body.action === "regenerate_carousel"
      ) {
        const result: RegenerationResult =
          body.action === "regenerate_caption"
            ? regenerateCaption(current)
            : regenerateCarousel(current);

        options.generated = {
          ...(result.caption !== undefined ? { caption: result.caption } : {}),
          ...(result.hashtags !== undefined ? { hashtags: result.hashtags } : {}),
          ...(result.altText !== undefined ? { altText: result.altText } : {}),
          ...(result.slides !== undefined ? { slides: result.slides } : {}),
          logs: [...current.generationLogs, ...result.logs],
        };
        options.commit = {
          author,
          source: "regeneration",
          summary: result.summary,
        };

        // Regenerating a rejected or failed post puts it back in front of a human.
        if (current.status === "rejected" || current.status === "failed") {
          options.status = "pending_review";
          options.note = undefined;
          options.failureReason = null;
        }
      }
    }

    if (body.commit && !options.commit) {
      options.commit = {
        author,
        source: "edit",
        summary: body.commit.summary?.trim() || "Edited content",
      };
    }

    const post = await updatePost(id, options);

    if (!post) {
      return NextResponse.json({ error: `No post with id ${id}` }, { status: 404 });
    }

    /* Every review decision and edit lands in the audit log. The schedule
       entry is removed alongside a rejection so a rejected post can never
       fire from the publishing queue. */
    const actor = actorFor(author);

    if (body.action === "approve") {
      await appendAudit({
        action: "approved",
        entityType: "post",
        entityId: id,
        postTitle: post.title,
        actor,
        detail: "Approved in dashboard",
      });
    } else if (body.action === "reject") {
      await unschedulePost(id);
      await appendAudit({
        action: "rejected",
        entityType: "post",
        entityId: id,
        postTitle: post.title,
        actor,
        detail: `Rejected — ${options.note ?? "no note"}`,
      });
    } else if (body.action === "reopen") {
      await appendAudit({
        action: "edited",
        entityType: "post",
        entityId: id,
        postTitle: post.title,
        actor,
        detail: "Sent back for review",
      });
      // Back in front of a human — ping the reviewer again.
      void notifyPostPending(post);
    } else if (body.action === "retry_publish") {
      await appendAudit({
        action: "retried",
        entityType: "post",
        entityId: id,
        postTitle: post.title,
        actor,
        detail: "Publish retry queued",
      });
    } else if (
      body.action === "regenerate_caption" ||
      body.action === "regenerate_carousel"
    ) {
      await appendAudit({
        action: "edited",
        entityType: "post",
        entityId: id,
        postTitle: post.title,
        actor,
        detail:
          body.action === "regenerate_caption"
            ? "Regenerated caption"
            : "Regenerated carousel",
      });
      // Rejected/failed regenerations land in pending_review.
      if (post.status === "pending_review") void notifyPostPending(post);
    } else if (options.fields && Object.keys(options.fields).length > 0) {
      const changes = Object.entries(options.fields).map(([field, value]) => ({
        field,
        from: describeValue(current[field as keyof Post]),
        to: describeValue(value),
      }));
      await appendAudit({
        action: "edited",
        entityType: "post",
        entityId: id,
        postTitle: post.title,
        actor,
        detail: `Edited ${Object.keys(options.fields).join(", ")}`,
        changes,
      });
    }

    return NextResponse.json({ post });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to update the post",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 400 },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const post = await getPost(id);
  const deleted = await deletePost(id);

  if (!deleted) {
    return NextResponse.json({ error: `No post with id ${id}` }, { status: 404 });
  }

  await unschedulePost(id);
  await appendAudit({
    action: "deleted",
    entityType: "post",
    entityId: id,
    postTitle: post?.title ?? null,
    actor: { name: "Kamal Dhiver", email: "kamal.dhiver@factory.local" },
    detail: "Deleted post",
  });

  return NextResponse.json({ ok: true });
}
