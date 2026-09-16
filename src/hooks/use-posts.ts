"use client";

import { useCallback, useMemo } from "react";

import { MOCK_NOW } from "@/data/time";
import { summariseQueue } from "@/lib/metrics";
import { applyPostsQuery } from "@/lib/posts/query";
import { usePostsStore } from "@/store/posts-store";
import type { BrandId, Post } from "@/types";

/* Selectors stay primitive so zustand snapshots remain referentially stable. */

export function useAllPosts() {
  return usePostsStore((state) => state.posts);
}

export function usePostsFilters() {
  return usePostsStore((state) => state.filters);
}

export function usePostsSort() {
  return usePostsStore((state) => state.sort);
}

export function useQueueViewMode() {
  return usePostsStore((state) => state.view);
}

export function useSelectedIds() {
  return usePostsStore((state) => state.selectedIds);
}

export function useFocusedId() {
  return usePostsStore((state) => state.focusedId);
}

export function usePendingIds() {
  return usePostsStore((state) => state.pendingIds);
}

export function useSavingIds() {
  return usePostsStore((state) => state.savingIds);
}

export function usePostsError() {
  return usePostsStore((state) => state.error);
}

/** Pagination lives in the store so a filter change can reset it in one write. */
export function useQueuePagination() {
  const page = usePostsStore((state) => state.page);
  const pageSize = usePostsStore((state) => state.pageSize);
  const setPage = usePostsStore((state) => state.setPage);
  const setPageSize = usePostsStore((state) => state.setPageSize);

  return { page, pageSize, setPage, setPageSize } as const;
}

/** The post currently open in the review drawer, kept in sync with the store. */
export function useOpenPost() {
  const openId = usePostsStore((state) => state.openId);
  const posts = useAllPosts();
  return useMemo(
    () => posts.find((post) => post.id === openId) ?? null,
    [posts, openId],
  );
}

/**
 * The topbar brand scope and the queue's brand filter are the same value: one
 * source of truth keeps dashboard, queue and schedule in agreement.
 */
export function useBrandScope() {
  const brandId = usePostsStore((state) => state.filters.brandId);
  const setFilter = usePostsStore((state) => state.setFilter);

  const setBrandId = useCallback(
    (value: BrandId | "all") => setFilter("brandId", value),
    [setFilter],
  );

  return { brandId, setBrandId } as const;
}

/** Posts narrowed by the workspace brand scope only. */
export function useScopedPosts(): Post[] {
  const posts = useAllPosts();
  const { brandId } = useBrandScope();

  return useMemo(
    () => (brandId === "all" ? posts : posts.filter((post) => post.brandId === brandId)),
    [posts, brandId],
  );
}

export function usePostsSummary() {
  const posts = useAllPosts();
  return useMemo(() => summariseQueue(posts), [posts]);
}

export function usePostsQuery(page: number, pageSize: number) {
  const posts = useAllPosts();
  const filters = usePostsFilters();
  const sort = usePostsSort();

  return useMemo(
    () => applyPostsQuery(posts, filters, sort, page, pageSize, MOCK_NOW),
    [posts, filters, sort, page, pageSize],
  );
}

/** Memoised action bundle — stable references, so effects never re-run. */
export function usePostsActions() {
  const setFilter = usePostsStore((state) => state.setFilter);
  const resetFilters = usePostsStore((state) => state.resetFilters);
  const setSort = usePostsStore((state) => state.setSort);
  const setView = usePostsStore((state) => state.setView);
  const toggleSelect = usePostsStore((state) => state.toggleSelect);
  const selectMany = usePostsStore((state) => state.selectMany);
  const clearSelection = usePostsStore((state) => state.clearSelection);
  const focusPost = usePostsStore((state) => state.focusPost);
  const openPost = usePostsStore((state) => state.openPost);
  const setStatus = usePostsStore((state) => state.setStatus);
  const saveFields = usePostsStore((state) => state.saveFields);
  const regenerate = usePostsStore((state) => state.regenerate);
  const duplicate = usePostsStore((state) => state.duplicate);
  const remove = usePostsStore((state) => state.remove);
  const restore = usePostsStore((state) => state.restore);
  const insert = usePostsStore((state) => state.insert);
  const hydrate = usePostsStore((state) => state.hydrate);
  const refresh = usePostsStore((state) => state.refresh);

  return useMemo(
    () => ({
      setFilter,
      resetFilters,
      setSort,
      setView,
      toggleSelect,
      selectMany,
      clearSelection,
      focusPost,
      openPost,
      setStatus,
      saveFields,
      regenerate,
      duplicate,
      remove,
      restore,
      insert,
      hydrate,
      refresh,
    }),
    [
      setFilter,
      resetFilters,
      setSort,
      setView,
      toggleSelect,
      selectMany,
      clearSelection,
      focusPost,
      openPost,
      setStatus,
      saveFields,
      regenerate,
      duplicate,
      remove,
      restore,
      insert,
      hydrate,
      refresh,
    ],
  );
}
