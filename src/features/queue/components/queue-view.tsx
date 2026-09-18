"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCheck,
  CircleAlert,
  Inbox,
  LayoutGrid,
  Rows3,
  SearchX,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { FilterSelect } from "@/components/data/filter-select";
import { Pagination } from "@/components/data/pagination";
import { EmptyState } from "@/components/feedback/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { BulkActions } from "@/features/queue/components/bulk-actions";
import { ConfirmActionDialog } from "@/features/queue/components/confirm-action-dialog";
import { GenerationRuns } from "@/features/queue/components/generation-runs";
import { PostCard } from "@/features/queue/components/post-card";
import { PostsTable } from "@/features/queue/components/posts-table";
import { QueueFilters } from "@/features/queue/components/queue-filters";
import { ReviewDrawer, type ReviewTab } from "@/features/queue/components/review-drawer";
import { StatusTabs } from "@/features/queue/components/status-tabs";
import {
  useFocusedId,
  useOpenPost,
  usePendingIds,
  usePostsActions,
  usePostsError,
  usePostsFilters,
  usePostsQuery,
  usePostsSort,
  useQueuePagination,
  useQueueViewMode,
  useSelectedIds,
  useAllPosts,
} from "@/hooks/use-posts";
import { useGenerationRuns } from "@/hooks/use-generation-runs";
import { useQueueShortcuts } from "@/hooks/use-queue-shortcuts";
import { averageQuality } from "@/lib/metrics";
import { listContainer, listItem } from "@/lib/motion";
import { isReviewable } from "@/lib/status";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type {
  Post,
  PostEditableField,
  PostsSortKey,
  PostVersion,
  QueueViewMode,
} from "@/types";

const SORT_OPTIONS: Array<{ value: PostsSortKey; label: string }> = [
  { value: "quality", label: "Quality score" },
  { value: "generated", label: "Generated date" },
  { value: "scheduled", label: "Scheduled date" },
  { value: "updated", label: "Last updated" },
  { value: "title", label: "Title" },
  { value: "status", label: "Status" },
];

type Confirmation =
  | { kind: "reject"; post: Post }
  | { kind: "delete"; post: Post }
  | { kind: "regenerate"; post: Post; target: "carousel" }
  | { kind: "bulk-reject" }
  | null;

export function QueueView() {
  const posts = useAllPosts();
  const filters = usePostsFilters();
  const sort = usePostsSort();
  const view = useQueueViewMode();
  const selectedIds = useSelectedIds();
  const focusedId = useFocusedId();
  const pendingIds = usePendingIds();
  const openPost = useOpenPost();
  const error = usePostsError();
  const actions = usePostsActions();
  const { page, pageSize, setPage, setPageSize } = useQueuePagination();
  // Runs are the queue's other half: a generation that failed produced no post,
  // so it only exists here.
  const runs = useGenerationRuns();

  const [drawerTab, setDrawerTab] = useState<ReviewTab>("preview");
  const [confirmation, setConfirmation] = useState<Confirmation>(null);
  const [hydrated, setHydrated] = useState(false);
  const handledDeepLink = useRef(false);

  const query = usePostsQuery(page, pageSize);

  // The dataset ships with the bundle so the first paint has real content; this
  // reconciles it with whatever is on disk before anyone starts editing.
  useEffect(() => {
    let cancelled = false;
    void actions
      .refresh()
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, [actions]);

  /** Deep links: /queue?item=post-1041 opens that post's drawer. */
  useEffect(() => {
    if (handledDeepLink.current) return;
    const id = new URLSearchParams(window.location.search).get("item");
    if (!id) return;
    handledDeepLink.current = true;
    if (posts.some((post) => post.id === id)) actions.openPost(id);
  }, [posts, actions]);

  const syncUrl = useCallback((id: string | null) => {
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("item", id);
    else url.searchParams.delete("item");
    window.history.replaceState(window.history.state, "", url);
  }, []);

  const open = useCallback(
    (post: Post, tab: ReviewTab = "preview") => {
      actions.openPost(post.id);
      setDrawerTab(tab);
      syncUrl(post.id);
    },
    [actions, syncUrl],
  );

  const close = useCallback(() => {
    actions.openPost(null);
    syncUrl(null);
  }, [actions, syncUrl]);

  const rows = query.rows;
  const reviewableRows = useMemo(() => rows.filter((post) => isReviewable(post.status)), [rows]);

  const approve = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return;
      void actions
        .setStatus(ids, "approved")
        .then(() =>
          toast.success(
            ids.length === 1 ? "Approved" : `${ids.length} posts approved`,
            { description: "They are ready for a publishing slot." },
          ),
        )
        .catch(() => undefined);
    },
    [actions],
  );

  const reject = useCallback(
    (ids: string[], note: string) => {
      if (ids.length === 0) return;
      void actions
        .setStatus(ids, "rejected", { note })
        .then(() =>
          toast.warning(
            ids.length === 1 ? "Post rejected" : `${ids.length} posts rejected`,
            { description: note },
          ),
        )
        .catch(() => undefined);
    },
    [actions],
  );

  const reopen = useCallback(
    (post: Post) => {
      void actions
        .setStatus([post.id], "pending_review")
        .then(() => toast.info("Reopened for review", { description: post.title }))
        .catch(() => undefined);
    },
    [actions],
  );

  const saveFields = useCallback(
    (
      id: string,
      fields: Partial<Pick<Post, PostEditableField>>,
      options?: { commit?: boolean; summary?: string },
    ) =>
      actions.saveFields(id, fields, {
        commit: options?.commit,
        summary: options?.summary,
      }),
    [actions],
  );

  const duplicate = useCallback(
    (post: Post) => {
      void actions
        .duplicate(post.id)
        .then((copy) =>
          toast.success("Duplicated as a draft", {
            description: copy ? `${copy.id} — ${copy.title}` : post.title,
          }),
        )
        .catch(() => undefined);
    },
    [actions],
  );

  const restoreVersion = useCallback(
    (post: Post, version: PostVersion) => {
      void actions
        .saveFields(post.id, { ...version.snapshot }, {
          commit: true,
          summary: `Restored Version ${version.number}`,
        })
        .then(() =>
          toast.success(`Restored Version ${version.number}`, {
            description: "A new version was recorded on top of the history.",
          }),
        )
        .catch(() => undefined);
    },
    [actions],
  );

  const regenerateCaption = useCallback(
    (post: Post) => {
      void actions
        .regenerate(post.id, "caption")
        .then((updated) =>
          toast.success("Caption regenerated", {
            description: updated
              ? `${updated.versions.length} versions now on record.`
              : post.title,
          }),
        )
        .catch(() => undefined);
    },
    [actions],
  );

  const confirmRegenerateCarousel = useCallback((post: Post) => {
    setConfirmation({ kind: "regenerate", post, target: "carousel" });
  }, []);

  /** J / K walk the current page and keep the focused row in view. */
  const moveFocus = useCallback(
    (direction: -1 | 1) => {
      if (rows.length === 0) return;
      const current = rows.findIndex((post) => post.id === focusedId);
      const next = (current + direction + rows.length) % rows.length;
      const post = current === -1 ? rows[0] : rows[next];
      actions.focusPost(post.id);
      document
        .querySelector(`[data-post-row="${post.id}"]`)
        ?.scrollIntoView({ block: "nearest" });
    },
    [actions, focusedId, rows],
  );

  const keyboardTarget = openPost ?? rows.find((post) => post.id === focusedId) ?? null;

  useQueueShortcuts({
    enabled: confirmation === null,
    onApprove: () => {
      if (!keyboardTarget || !isReviewable(keyboardTarget.status)) return;
      approve([keyboardTarget.id]);
    },
    onReject: () => {
      if (!keyboardTarget || !isReviewable(keyboardTarget.status)) return;
      setConfirmation({ kind: "reject", post: keyboardTarget });
    },
    onMoveFocus: moveFocus,
    onOpen: () => {
      if (keyboardTarget) open(keyboardTarget);
    },
    onClose: () => {
      if (openPost) close();
    },
    onSelectAll: () => actions.selectMany(reviewableRows.map((post) => post.id)),
  });

  const allOnPageSelected =
    reviewableRows.length > 0 &&
    reviewableRows.every((post) => selectedIds.includes(post.id));

  const activeRow = keyboardTarget;
  const activeIndex = rows.findIndex((post) => post.id === activeRow?.id);

  return (
    <>
      <PageHeader
        eyebrow="Content queue"
        title="Review, approve, publish"
        description={`${posts.length} posts across 3 brands · avg quality ${averageQuality(posts)} · auto-saves as you edit.`}
        actions={
          <>
            <Button
              variant="secondary"
              onClick={actions.clearSelection}
              disabled={selectedIds.length === 0}
            >
              Clear selection
            </Button>
            <Button
              variant="primary"
              disabled={reviewableRows.length === 0}
              onClick={() => approve(reviewableRows.map((post) => post.id))}
            >
              <CheckCheck />
              Approve reviewable
              <span className="tnum">{reviewableRows.length}</span>
            </Button>
          </>
        }
        toolbar={
          <div className="flex flex-col gap-3">
            <StatusTabs
              posts={posts}
              value={filters.status}
              onChange={(value) => actions.setFilter("status", value)}
            />
            <QueueFilters
              filters={filters}
              onFilterChange={actions.setFilter}
              onReset={actions.resetFilters}
              trailing={
                <div className="flex items-center gap-2">
                  <FilterSelect<PostsSortKey>
                    label="Sort by"
                    value={sort.key}
                    onValueChange={(key) => actions.setSort(key)}
                    options={SORT_OPTIONS}
                  />
                  <ViewSwitch value={view} onChange={actions.setView} />
                </div>
              }
            />
          </div>
        }
      />

      <div className="shell-container flex flex-col gap-4 pb-8">
        <GenerationRuns />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="flex items-center gap-2.5">
            {reviewableRows.length > 0 ? (
              <>
                <Checkbox
                  id="queue-select-page"
                  checked={allOnPageSelected}
                  onCheckedChange={(checked) =>
                    checked
                      ? actions.selectMany([
                          ...new Set([
                            ...selectedIds,
                            ...reviewableRows.map((post) => post.id),
                          ]),
                        ])
                      : actions.selectMany(
                          selectedIds.filter(
                            (id) => !reviewableRows.some((post) => post.id === id),
                          ),
                        )
                  }
                />
                <Label htmlFor="queue-select-page" className="text-ink-2">
                  Select reviewable on page
                </Label>
              </>
            ) : null}
          </span>

          <span className="flex flex-wrap items-center gap-3 text-[12px] text-ink-3">
            <span className="tnum" aria-live="polite">
              {query.total} of {posts.length} posts match
              {activeIndex >= 0 ? ` · row ${activeIndex + 1} focused` : ""}
            </span>
            <span className="hidden items-center gap-2 sm:flex">
              <kbd className="rounded-xs border border-line bg-surface px-1 font-mono text-[10px]">
                A
              </kbd>
              approve
              <kbd className="rounded-xs border border-line bg-surface px-1 font-mono text-[10px]">
                R
              </kbd>
              reject
              <kbd className="rounded-xs border border-line bg-surface px-1 font-mono text-[10px]">
                J
              </kbd>
              <kbd className="rounded-xs border border-line bg-surface px-1 font-mono text-[10px]">
                K
              </kbd>
              move
            </span>
          </span>
        </div>

        {error ? (
          <div
            role="alert"
            className="flex items-center justify-between gap-3 rounded-lg border border-danger/20 bg-danger-soft px-3.5 py-2.5 text-[12.5px] text-danger"
          >
            <span className="flex items-center gap-2">
              <CircleAlert className="size-3.5 shrink-0" />
              {error}
            </span>
            <Button
              size="xs"
              variant="ghost"
              className="text-danger hover:bg-danger/10"
              onClick={() => void actions.refresh().catch(() => undefined)}
            >
              Reload posts
            </Button>
          </div>
        ) : null}

        {!hydrated && posts.length === 0 ? (
          <QueueSkeleton />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={posts.length === 0 ? Inbox : SearchX}
            title={
              posts.length === 0
                ? "The queue is empty"
                : "Nothing matches these filters"
            }
            description={
              posts.length === 0
                ? "Generated posts land here automatically, ready for review."
                : "Widen the status, brand or date range — or clear the search field."
            }
            action={
              posts.length === 0 ? undefined : (
                <Button variant="secondary" onClick={actions.resetFilters}>
                  Reset filters
                </Button>
              )
            }
          />
        ) : view === "table" ? (
          <PostsTable
            posts={rows}
            selectedIds={selectedIds}
            focusedId={focusedId}
            openId={openPost?.id ?? null}
            pendingIds={pendingIds}
            sort={sort}
            onSort={(key) => actions.setSort(key)}
            onToggleSelect={actions.toggleSelect}
            onSelectAll={(checked) =>
              checked
                ? actions.selectMany([
                    ...new Set([...selectedIds, ...reviewableRows.map((post) => post.id)]),
                  ])
                : actions.selectMany(
                    selectedIds.filter(
                      (id) => !reviewableRows.some((post) => post.id === id),
                    ),
                  )
            }
            allSelected={allOnPageSelected}
            onOpen={open}
            onApprove={(post) => approve([post.id])}
            onReject={(post) => setConfirmation({ kind: "reject", post })}
            onRegenerate={(post, target) =>
              target === "caption"
                ? regenerateCaption(post)
                : confirmRegenerateCarousel(post)
            }
            onDuplicate={duplicate}
            onDelete={(post) => setConfirmation({ kind: "delete", post })}
            onReopen={reopen}
            onSaveField={saveFields}
            runForPost={runs.runForPost}
          />
        ) : (
          <motion.ul
            key={`${view}-${filters.status}-${page}`}
            variants={listContainer}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3"
          >
            {rows.map((post) => (
              <motion.li key={post.id} variants={listItem}>
                <PostCard
                  post={post}
                  selected={selectedIds.includes(post.id)}
                  focused={focusedId === post.id}
                  open={openPost?.id === post.id}
                  pending={pendingIds.includes(post.id)}
                  onToggleSelect={actions.toggleSelect}
                  onOpen={open}
                  onApprove={(target) => approve([target.id])}
                  onReject={(target) => setConfirmation({ kind: "reject", post: target })}
                  onRegenerate={(target, kind) =>
                    kind === "caption"
                      ? regenerateCaption(target)
                      : confirmRegenerateCarousel(target)
                  }
                  onDuplicate={duplicate}
                  onDelete={(target) => setConfirmation({ kind: "delete", post: target })}
                  onSaveField={saveFields}
                  run={runs.runForPost(post.id)}
                />
              </motion.li>
            ))}
          </motion.ul>
        )}

        <Pagination
          page={query.page}
          pageCount={query.pageCount}
          pageSize={pageSize}
          total={query.total}
          rangeStart={query.rangeStart}
          rangeEnd={query.rangeEnd}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          itemLabel="posts"
        />

        <AnimatePresence>
          <BulkActions
            count={selectedIds.length}
            onApprove={() => approve(selectedIds)}
            onReject={() => setConfirmation({ kind: "bulk-reject" })}
            onClear={actions.clearSelection}
          />
        </AnimatePresence>

      </div>

      <ReviewDrawer
        post={openPost}
        initialTab={drawerTab}
        onOpenChange={(next) => (next ? undefined : close())}
        onApprove={(post) => approve([post.id])}
        onReject={(post) => setConfirmation({ kind: "reject", post })}
        onRegenerate={(post, target) =>
          target === "caption" ? regenerateCaption(post) : confirmRegenerateCarousel(post)
        }
        onDuplicate={duplicate}
        onDelete={(post) => setConfirmation({ kind: "delete", post })}
        onRestoreVersion={(post, version) => restoreVersion(post, version)}
        onSaveFields={saveFields}
        pending={openPost ? pendingIds.includes(openPost.id) : false}
        run={openPost ? runs.runForPost(openPost.id) : null}
      />

      <ConfirmActionDialog
        open={confirmation?.kind === "reject"}
        onOpenChange={(next) => (next ? undefined : setConfirmation(null))}
        title="Reject this post?"
        description={
          confirmation?.kind === "reject"
            ? `${confirmation.post.id} · ${confirmation.post.title}`
            : undefined
        }
        confirmLabel="Reject post"
        note={{
          label: "Why is it going back?",
          placeholder: "The hook buries the insight — lead with the number.",
          hint: "The note is stored on the post and stays visible in the queue.",
        }}
        onConfirm={(note) => {
          if (confirmation?.kind !== "reject") return;
          const post = confirmation.post;
          reject([post.id], note.trim() || "Rejected without a note.");
        }}
      />

      <ConfirmActionDialog
        open={confirmation?.kind === "bulk-reject"}
        onOpenChange={(next) => (next ? undefined : setConfirmation(null))}
        title={`Reject ${selectedIds.length} posts?`}
        description="The same note is attached to every post you selected."
        confirmLabel="Reject posts"
        note={{
          label: "Shared review note",
          placeholder: "Tighten the openings and re-check every citation.",
        }}
        onConfirm={(note) => {
          reject(selectedIds, note.trim() || "Batch review feedback.");
          actions.clearSelection();
        }}
      />

      <ConfirmActionDialog
        open={confirmation?.kind === "delete"}
        onOpenChange={(next) => (next ? undefined : setConfirmation(null))}
        title="Delete this post?"
        description={
          confirmation?.kind === "delete"
            ? `${confirmation.post.id} · ${confirmation.post.title} — and its ${confirmation.post.versions.length} versions.`
            : undefined
        }
        confirmLabel="Delete permanently"
        onConfirm={() => {
          if (confirmation?.kind !== "delete") return;
          const post = confirmation.post;
          void actions
            .remove(post.id)
            .then(() =>
              toast.error("Post deleted", {
                description: post.title,
                action: {
                  label: "Undo",
                  onClick: () => void actions.restore(post).catch(() => undefined),
                },
              }),
            )
            .catch(() => undefined);
        }}
      />

      <ConfirmActionDialog
        open={confirmation?.kind === "regenerate"}
        onOpenChange={(next) => (next ? undefined : setConfirmation(null))}
        title="Regenerate the carousel?"
        description="The slide order and framing are rebuilt from the same research. The current version stays in the history, so this is reversible."
        confirmLabel="Regenerate carousel"
        tone="primary"
        onConfirm={() => {
          if (confirmation?.kind !== "regenerate") return;
          const post = confirmation.post;
          void actions
            .regenerate(post.id, "carousel")
            .then(() =>
              toast.success("Carousel regenerated", {
                description: "A new version was recorded before the rebuild.",
              }),
            )
            .catch(() => undefined);
        }}
      />
    </>
  );
}

function ViewSwitch({
  value,
  onChange,
}: {
  value: QueueViewMode;
  onChange: (view: QueueViewMode) => void;
}) {
  return (
    <div
      role="group"
      aria-label="View mode"
      className="flex items-center gap-0.5 rounded-full border border-line bg-surface-2 p-0.5"
    >
      <Button
        size="icon-sm"
        variant={value === "table" ? "primary" : "ghost"}
        onClick={() => onChange("table")}
        aria-label="Table view"
        aria-pressed={value === "table"}
        className={cn(value !== "table" && "text-ink-2")}
      >
        <Rows3 />
      </Button>
      <Button
        size="icon-sm"
        variant={value === "cards" ? "primary" : "ghost"}
        onClick={() => onChange("cards")}
        aria-label="Card view"
        aria-pressed={value === "cards"}
        className={cn(value !== "cards" && "text-ink-2")}
      >
        <LayoutGrid />
      </Button>
    </div>
  );
}

function QueueSkeleton() {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="animate-sheen h-16 rounded-md bg-surface-2"
          aria-hidden="true"
        />
      ))}
    </div>
  );
}
