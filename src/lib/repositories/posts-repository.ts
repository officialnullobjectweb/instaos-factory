import { randomUUID } from "node:crypto";

import { document } from "@/lib/storage";
import type {
  ContentStatus,
  Post,
  PostEditableField,
  PostSnapshot,
  PostVersion,
  VersionSource,
} from "@/types";

/**
 * The single place that reads or writes the posts document.
 *
 * Components never touch storage: they call the API routes, which call these
 * helpers. Concurrency, the read cache and the seed fallback live in the shared
 * document layer; what lives here is the shape of a post, the version history,
 * and the validation that keeps a corrupt dataset from reaching the UI.
 */

const REQUIRED_STRING_FIELDS = [
  "id",
  "title",
  "caption",
  "brandId",
  "status",
  "format",
  "category",
  "owner",
  "generatedAt",
] as const;

const VALID_STATUSES: ContentStatus[] = [
  "draft",
  "pending_review",
  "approved",
  "scheduled",
  "published",
  "failed",
  "rejected",
];

class PostsDataError extends Error {
  constructor(message: string) {
    super(`The posts dataset is invalid: ${message}`);
    this.name = "PostsDataError";
  }
}

/**
 * Validates one post.
 *
 * Unlike the audit log and the other lists, a malformed post **throws** rather
 * than being dropped. A dropped post would look like content the user deleted,
 * and every count on the queue would be quietly wrong; an invalid one is a
 * fixture or migration bug that should be fixed. Silently discarding it in
 * production would hide exactly the problem worth seeing.
 */
function assertPost(value: unknown, index: number): Post {
  if (typeof value !== "object" || value === null) {
    throw new PostsDataError(`entry ${index} is not an object`);
  }

  const candidate = value as Record<string, unknown>;

  for (const field of REQUIRED_STRING_FIELDS) {
    if (typeof candidate[field] !== "string" || candidate[field] === "") {
      throw new PostsDataError(`entry ${index} is missing "${field}"`);
    }
  }

  if (!VALID_STATUSES.includes(candidate.status as ContentStatus)) {
    throw new PostsDataError(
      `entry ${index} has unknown status "${String(candidate.status)}"`,
    );
  }

  if (!Array.isArray(candidate.slides) || candidate.slides.length === 0) {
    throw new PostsDataError(`entry ${index} has no slides`);
  }

  if (!Array.isArray(candidate.versions) || candidate.versions.length === 0) {
    throw new PostsDataError(`entry ${index} has no version history`);
  }

  return candidate as unknown as Post;
}

function parsePosts(raw: unknown): Post[] | null {
  if (!Array.isArray(raw)) {
    throw new PostsDataError("expected a top-level array");
  }
  return raw.map(assertPost);
}

const posts = () =>
  document<Post[]>({
    key: "posts",
    parse: parsePosts,
    /**
     * Reached only when neither the store nor the committed fixture has a
     * dataset. Failing loudly is deliberate: an empty queue that looks like a
     * working app is harder to diagnose than an error that names the fix.
     */
    fallback: () => {
      throw new PostsDataError(
        "no dataset was found. Run `node scripts/seed-posts.mjs` to write the " +
          "seed fixture, or check that data/posts.json is included in the " +
          "deployment bundle.",
      );
    },
  });

function nextId(current: Post[]) {
  const highest = current.reduce((max, post) => {
    const numeric = Number.parseInt(post.id.replace(/\D/g, ""), 10);
    return Number.isNaN(numeric) ? max : Math.max(max, numeric);
  }, 1000);
  return `post-${highest + 1}`;
}

export function snapshotOf(post: Post): PostSnapshot {
  return {
    title: post.title,
    caption: post.caption,
    hashtags: [...post.hashtags],
    altText: post.altText,
    slides: post.slides.map((slide) => ({ ...slide })),
  };
}

export function createVersion(
  post: Post,
  input: {
    author: string;
    source: VersionSource;
    summary: string;
    createdAt?: string;
  },
): PostVersion {
  const number =
    post.versions.reduce((max, version) => Math.max(max, version.number), 0) + 1;

  return {
    id: `${post.id}-v${number}-${randomUUID().slice(0, 6)}`,
    number,
    label: `Version ${number}`,
    createdAt: input.createdAt ?? new Date().toISOString(),
    author: input.author,
    source: input.source,
    summary: input.summary,
    snapshot: snapshotOf(post),
  };
}

/* -------------------------------------------------------------------------- */
/*  Public API                                                                */
/* -------------------------------------------------------------------------- */

export async function listPosts(): Promise<Post[]> {
  const current = await posts().read();
  // Shallow copies: callers must not be able to mutate the cached document.
  return current.map((post) => ({ ...post }));
}

export async function getPost(id: string): Promise<Post | null> {
  const current = await posts().read();
  const post = current.find((candidate) => candidate.id === id);
  return post ? { ...post } : null;
}

export async function createPost(draft: Post): Promise<Post> {
  const now = new Date().toISOString();

  // The id is derived from the document inside the mutation, so a retry after a
  // concurrent write allocates an id that does not collide.
  const next = await posts().mutate((current) => {
    const post: Post = {
      ...draft,
      id: draft.id && draft.id.trim() !== "" ? draft.id : nextId(current),
      createdAt: draft.createdAt ?? now,
      updatedAt: now,
      assetCount: draft.slides.length,
    };

    return [post, ...current];
  });

  return next[0];
}

export interface UpdatePostOptions {
  /** Fields the reviewer changed. */
  fields?: Partial<Pick<Post, PostEditableField>>;
  /** Status transition to apply in the same write. */
  status?: ContentStatus;
  note?: string;
  failureReason?: string | null;
  scheduledFor?: string | null;
  publishedAt?: string | null;
  retryCount?: number;
  /** Append a version capturing the post *after* the change. */
  commit?: {
    author: string;
    source: VersionSource;
    summary: string;
    /** Snapshot taken before the change, when the change is a regeneration. */
    before?: PostSnapshot;
  };
  /** Fields the generator replaced, merged in before the version is cut. */
  generated?: Partial<Pick<Post, "caption" | "hashtags" | "slides" | "altText">> & {
    logs?: Post["generationLogs"];
  };
}

export async function updatePost(
  id: string,
  options: UpdatePostOptions,
): Promise<Post | null> {
  let found = false;

  const next = await posts().mutate((current) => {
    const index = current.findIndex((candidate) => candidate.id === id);
    if (index === -1) return current;

    found = true;
    const existing = current[index];
    const generated = options.generated;
    const fields: Partial<Post> = { ...options.fields };

    if (generated) {
      if (generated.caption !== undefined) fields.caption = generated.caption;
      if (generated.hashtags !== undefined) fields.hashtags = generated.hashtags;
      if (generated.slides !== undefined) fields.slides = generated.slides;
      if (generated.altText !== undefined) fields.altText = generated.altText;
    }

    const merged: Post = {
      ...existing,
      ...fields,
      ...(options.status ? { status: options.status } : {}),
      ...(options.note !== undefined ? { reviewNote: options.note } : {}),
      ...(options.failureReason !== undefined
        ? { failureReason: options.failureReason }
        : {}),
      ...(options.scheduledFor !== undefined
        ? { scheduledFor: options.scheduledFor }
        : {}),
      ...(options.publishedAt !== undefined
        ? { publishedAt: options.publishedAt }
        : {}),
      ...(options.retryCount !== undefined ? { retryCount: options.retryCount } : {}),
      ...(generated?.logs ? { generationLogs: generated.logs } : {}),
      updatedAt: new Date().toISOString(),
      assetCount: (fields.slides ?? existing.slides).length,
    };

    let withVersion: Post = merged;
    if (options.commit) {
      withVersion = {
        ...merged,
        versions: [...merged.versions, createVersion(merged, options.commit)],
      };
      // The version's timestamp is authoritative, so the post does not claim to
      // have been updated before its own latest revision.
      withVersion.updatedAt = withVersion.versions.at(-1)!.createdAt;
    }

    const updated = [...current];
    updated[index] = withVersion;
    return updated;
  });

  if (!found) return null;
  return next.find((post) => post.id === id) ?? null;
}

export async function deletePost(id: string): Promise<boolean> {
  let removed = false;

  await posts().mutate((current) => {
    const filtered = current.filter((post) => post.id !== id);
    if (filtered.length === current.length) return current;
    removed = true;
    return filtered;
  });

  return removed;
}

export async function duplicatePost(id: string): Promise<Post | null> {
  const now = new Date().toISOString();
  let copyId = "";

  const next = await posts().mutate((current) => {
    const source = current.find((post) => post.id === id);
    if (!source) return current;

    copyId = nextId(current);
    const slides = source.slides.map((slide, index) => ({
      ...slide,
      id: `${copyId}-slide-${index + 1}`,
    }));

    const copy: Post = {
      ...source,
      id: copyId,
      title: `${source.title} (copy)`,
      status: "draft",
      scheduledFor: null,
      publishedAt: null,
      failureReason: null,
      retryCount: 0,
      reviewNote: undefined,
      metrics: undefined,
      createdAt: now,
      updatedAt: now,
      slides,
      versions: [
        {
          id: `${copyId}-v1`,
          number: 1,
          label: "Version 1",
          createdAt: now,
          author: source.owner,
          source: "edit",
          summary: `Duplicated from ${source.id} — history resets on copy.`,
          snapshot: {
            title: `${source.title} (copy)`,
            caption: source.caption,
            hashtags: [...source.hashtags],
            altText: source.altText,
            slides,
          },
        },
      ],
      generationLogs: [
        ...source.generationLogs,
        {
          id: `${copyId}-log-duplicate`,
          step: "brief",
          status: "success",
          message: `Duplicated from ${source.id}. Version history restarts on copies.`,
          durationMs: 90,
          timestamp: now,
          model: "factory-engine-v4.2",
          tokens: 0,
        },
      ],
    };

    return [copy, ...current];
  });

  return next.find((post) => post.id === copyId) ?? null;
}

/** Used by the seed scripts to put the fixture dataset back. */
export async function replaceAll(entries: Post[]): Promise<Post[]> {
  return posts().write(entries);
}
