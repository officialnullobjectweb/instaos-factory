import { create } from "zustand";

import { PAGINATION } from "@/lib/constants";
import { postsApi, PostsApiError } from "@/lib/api/posts-client";
import { EMPTY_POST_FILTERS } from "@/types";
import type {
  ContentStatus,
  Post,
  PostEditableField,
  PostsFilters,
  PostsSort,
  PostsSortKey,
  QueueViewMode,
} from "@/types";

/**
 * Single source of truth for the content queue on the client.
 *
 * The server API is the only source of posts — the store starts empty and is
 * hydrated from `GET /api/posts` on mount. Every write is optimistic with a
 * full rollback on failure — the server response is authoritative because it
 * is what created the version history.
 */

interface PostsState {
  posts: Post[];
  filters: PostsFilters;
  sort: PostsSort;
  view: QueueViewMode;
  page: number;
  pageSize: number;
  selectedIds: string[];
  focusedId: string | null;
  openId: string | null;
  /** Ids with an in-flight write. */
  pendingIds: string[];
  /** Ids where autosave is currently flushing. */
  savingIds: string[];
  hydratedAt: string | null;
  error: string | null;

  hydrate: (posts: Post[]) => void;
  refresh: () => Promise<void>;

  setFilter: <K extends keyof PostsFilters>(key: K, value: PostsFilters[K]) => void;
  resetFilters: () => void;
  setSort: (key: PostsSortKey) => void;
  setView: (view: QueueViewMode) => void;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;

  toggleSelect: (id: string) => void;
  selectMany: (ids: string[]) => void;
  clearSelection: () => void;

  focusPost: (id: string | null) => void;
  openPost: (id: string | null) => void;

  setStatus: (
    ids: string[],
    status: ContentStatus,
    options?: { note?: string },
  ) => Promise<void>;
  saveFields: (
    id: string,
    fields: Partial<Pick<Post, PostEditableField>>,
    options?: { commit?: boolean; summary?: string; author?: string },
  ) => Promise<Post | null>;
  regenerate: (
    id: string,
    target: "caption" | "carousel",
  ) => Promise<Post | null>;
  duplicate: (id: string) => Promise<Post | null>;
  remove: (id: string) => Promise<Post | null>;
  restore: (post: Post) => Promise<Post | null>;
  /**
   * Adds a post the server already created (e.g. a generated draft). No request
   * is made — the API is the source of truth and this only mirrors its result.
   */
  insert: (post: Post) => void;
}

function replacePost(posts: Post[], next: Post) {
  return posts.map((post) => (post.id === next.id ? next : post));
}

function patchPosts(posts: Post[], ids: string[], patch: Partial<Post>) {
  const target = new Set(ids);
  return posts.map((post) =>
    target.has(post.id) ? { ...post, ...patch } : post,
  );
}

const nowIso = () => new Date().toISOString();

export const usePostsStore = create<PostsState>((set, get) => {
  /** Runs a write against every id, rolling the whole batch back on any failure. */
  async function write(
    ids: string[],
    optimistic: Partial<Post>,
    send: (id: string) => Promise<Post>,
  ) {
    const snapshot = get().posts;
    set((state) => ({
      posts: patchPosts(state.posts, ids, optimistic),
      pendingIds: [...new Set([...state.pendingIds, ...ids])],
      error: null,
    }));

    try {
      const results = await Promise.all(ids.map(send));
      set((state) => {
        let next = state.posts;
        for (const post of results) next = replacePost(next, post);
        return {
          posts: next,
          pendingIds: state.pendingIds.filter((id) => !ids.includes(id)),
          hydratedAt: nowIso(),
        };
      });
    } catch (error) {
      set((state) => ({
        posts: snapshot,
        pendingIds: state.pendingIds.filter((id) => !ids.includes(id)),
        error:
          error instanceof PostsApiError
            ? error.message
            : error instanceof Error
              ? error.message
              : "Something went wrong",
      }));
      throw error;
    }
  }

  async function writeOne(
    id: string,
    optimistic: Partial<Post>,
    send: () => Promise<Post>,
  ) {
    const snapshot = get().posts;
    set((state) => ({
      posts: patchPosts(state.posts, [id], optimistic),
      pendingIds: [...new Set([...state.pendingIds, id])],
      error: null,
    }));

    try {
      const post = await send();
      set((state) => ({
        posts: replacePost(state.posts, post),
        pendingIds: state.pendingIds.filter((candidate) => candidate !== id),
        savingIds: state.savingIds.filter((candidate) => candidate !== id),
        hydratedAt: nowIso(),
      }));
      return post;
    } catch (error) {
      set((state) => ({
        posts: snapshot,
        pendingIds: state.pendingIds.filter((candidate) => candidate !== id),
        savingIds: state.savingIds.filter((candidate) => candidate !== id),
        error:
          error instanceof PostsApiError
            ? error.message
            : error instanceof Error
              ? error.message
              : "Something went wrong",
      }));
      throw error;
    }
  }

  return {
    posts: [],
    filters: { ...EMPTY_POST_FILTERS, status: "pending_review" },
    sort: { key: "quality", direction: "desc" },
    view: "table",
    page: 1,
    pageSize: PAGINATION.defaultPageSize,
    selectedIds: [],
    focusedId: null,
    openId: null,
    pendingIds: [],
    savingIds: [],
    hydratedAt: null,
    error: null,

    hydrate: (next) => set({ posts: next, hydratedAt: nowIso() }),

    refresh: async () => {
      const server = await postsApi.list();
      set({ posts: server, hydratedAt: nowIso() });
    },

    setFilter: (key, value) =>
      set((state) => ({
        filters: { ...state.filters, [key]: value },
        selectedIds: [],
        page: 1,
      })),

    resetFilters: () =>
      set({ filters: { ...EMPTY_POST_FILTERS }, selectedIds: [], page: 1 }),

    setSort: (key) =>
      set((state) => ({
        sort: {
          key,
          direction:
            state.sort.key === key && state.sort.direction === "desc"
              ? "asc"
              : "desc",
        },
      })),

    setView: (view) => set({ view }),

    setPage: (page) => set({ page }),

    setPageSize: (pageSize) => set({ pageSize, page: 1 }),

    toggleSelect: (id) =>
      set((state) => ({
        selectedIds: state.selectedIds.includes(id)
          ? state.selectedIds.filter((candidate) => candidate !== id)
          : [...state.selectedIds, id],
      })),

    selectMany: (ids) => set({ selectedIds: ids }),
    clearSelection: () => set({ selectedIds: [] }),

    focusPost: (id) => set({ focusedId: id }),
    openPost: (id) => set({ openId: id, focusedId: id ?? get().focusedId }),

    setStatus: async (ids, status, options) => {
      if (ids.length === 0) return;

      // Only four transitions exist as API actions. Anything else would need a
      // new endpoint, so fail loudly instead of writing the wrong status.
      if (!["approved", "pending_review", "scheduled", "rejected"].includes(status)) {
        throw new Error(`Unsupported status transition to "${status}"`);
      }

      const optimistic: Partial<Post> = { status, updatedAt: nowIso() };
      if (options?.note !== undefined) optimistic.reviewNote = options.note;
      if (status === "rejected") optimistic.scheduledFor = null;
      if (status === "approved" || status === "pending_review") {
        optimistic.reviewNote = undefined;
      }
      if (status === "scheduled") {
        optimistic.failureReason = null;
        optimistic.scheduledFor =
          (get().posts.find((post) => post.id === ids[0])?.scheduledFor ??
            new Date(Date.now() + 3_600_000).toISOString());
      }

      await write(ids, optimistic, (id) =>
        status === "rejected"
          ? postsApi.reject(id, options?.note ?? "Sent back for changes.")
          : status === "approved"
            ? postsApi.approve(id)
            : status === "scheduled"
              ? postsApi.retryPublish(id)
              : postsApi.reopen(id),
      );

      set({ selectedIds: [] });
    },

    saveFields: async (id, fields, options) => {
      const post = get().posts.find((candidate) => candidate.id === id);
      if (!post) return null;

      set((state) => ({
        savingIds: [...new Set([...state.savingIds, id])],
      }));

      const updated = await writeOne(id, fields, () =>
        postsApi.patch(id, {
          fields,
          ...(options?.commit
            ? {
                commit: {
                  summary: options.summary ?? "Edited content",
                  author: options.author,
                },
              }
            : {}),
        }),
      );

      set((state) => ({
        savingIds: state.savingIds.filter((candidate) => candidate !== id),
      }));
      return updated;
    },

    regenerate: async (id, target) => {
      const post = get().posts.find((candidate) => candidate.id === id);
      if (!post) return null;

      set((state) => ({
        savingIds: [...new Set([...state.savingIds, id])],
      }));

      const updated = await writeOne(
        id,
        {
          ...(target === "caption" ? { caption: "Regenerating caption…" } : {}),
          status:
            post.status === "rejected" || post.status === "failed"
              ? "pending_review"
              : post.status,
        },
        () => postsApi.regenerate(id, target),
      );

      set((state) => ({
        savingIds: state.savingIds.filter((candidate) => candidate !== id),
      }));
      return updated;
    },

    duplicate: async (id) => {
      const copy = await postsApi.duplicate(id);
      set((state) => ({ posts: [copy, ...state.posts] }));
      return copy;
    },

    remove: async (id) => {
      const post = get().posts.find((candidate) => candidate.id === id);
      if (!post) return null;

      set((state) => ({
        posts: state.posts.filter((candidate) => candidate.id !== id),
        selectedIds: state.selectedIds.filter((candidate) => candidate !== id),
        openId: state.openId === id ? null : state.openId,
      }));

      try {
        await postsApi.remove(id);
        return post;
      } catch (error) {
        set((state) => ({ posts: [post, ...state.posts] }));
        throw error;
      }
    },

    restore: async (post) => {
      const created = await postsApi.create(post);
      set((state) => ({
        posts: [created, ...state.posts.filter((p) => p.id !== post.id)],
      }));
      return created;
    },

    insert: (post) =>
      set((state) => ({
        posts: [post, ...state.posts.filter((existing) => existing.id !== post.id)],
        hydratedAt: nowIso(),
      })),
  };
});
