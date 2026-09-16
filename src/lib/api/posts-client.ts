import type { ContentStatus, Post, PostEditableField } from "@/types";

/**
 * The client's only route to `data/posts.json`. Components never call this
 * directly either — the posts store wraps it — but keeping every request in one
 * typed module means the transport is swappable and errors stay consistent.
 */

export class PostsApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "PostsApiError";
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: string; detail?: string }
      | null;
    throw new PostsApiError(
      payload?.detail ?? payload?.error ?? `Request failed (${response.status})`,
      response.status,
    );
  }

  return (await response.json()) as T;
}

export type PostAction =
  | "approve"
  | "reject"
  | "reopen"
  | "retry_publish"
  | "regenerate_caption"
  | "regenerate_carousel";

export interface PatchPostInput {
  action?: PostAction;
  note?: string;
  author?: string;
  fields?: Partial<Pick<Post, PostEditableField>>;
  commit?: { summary?: string; author?: string };
}

export async function fetchPosts() {
  const { posts } = await request<{ posts: Post[] }>("/api/posts", {
    cache: "no-store",
  });
  return posts;
}

export async function patchPost(id: string, input: PatchPostInput) {
  const { post } = await request<{ post: Post }>(`/api/posts/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return post;
}

export async function duplicatePostRequest(id: string) {
  const { post } = await request<{ post: Post }>(`/api/posts/${id}/duplicate`, {
    method: "POST",
  });
  return post;
}

export async function deletePostRequest(id: string) {
  await request<{ ok: boolean }>(`/api/posts/${id}`, { method: "DELETE" });
  return id;
}

export async function createPostRequest(post: Post) {
  const { post: created } = await request<{ post: Post }>("/api/posts", {
    method: "POST",
    body: JSON.stringify({ post }),
  });
  return created;
}

/** Convenience wrappers so call sites read as intent, not as HTTP. */
export const postsApi = {
  list: fetchPosts,
  patch: patchPost,
  duplicate: duplicatePostRequest,
  remove: deletePostRequest,
  create: createPostRequest,
  approve: (id: string, author?: string) =>
    patchPost(id, { action: "approve", author }),
  reject: (id: string, note: string, author?: string) =>
    patchPost(id, { action: "reject", note, author }),
  reopen: (id: string, author?: string) => patchPost(id, { action: "reopen", author }),
  retryPublish: (id: string, author?: string) =>
    patchPost(id, { action: "retry_publish", author }),
  regenerate: (id: string, target: "caption" | "carousel", author?: string) =>
    patchPost(id, {
      action: target === "caption" ? "regenerate_caption" : "regenerate_carousel",
      author,
    }),
} as const;

export const STATUS_BULK_ACTIONS: Record<string, ContentStatus> = {
  approve: "approved",
  reopen: "pending_review",
};
