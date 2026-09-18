"use client";

import { ArrowDown, ArrowUp, LoaderCircle } from "lucide-react";
import Image from "next/image";
import { Fragment, useId, useState } from "react";

import { AssetPreview } from "@/components/content/asset-preview";
import { FormatTag, StatusBadge } from "@/components/content/status-badge";
import { QualityMeter } from "@/components/content/quality-meter";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Disclosure, DisclosureButton } from "@/components/ui/disclosure";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getBrand } from "@/data/brands";
import { MOCK_NOW } from "@/data/time";
import { GenerationSteps } from "@/features/queue/components/generation-steps";
import { InlineField } from "@/features/queue/components/inline-field";
import { PostActions, QuickDecision } from "@/features/queue/components/post-actions";
import type { ReviewTab } from "@/features/queue/components/review-drawer";
import { formatDateTime, formatRelativeTime } from "@/lib/format";
import { FORMAT_LABELS, isReviewable } from "@/lib/status";
import { cn } from "@/lib/utils";
import type {
  GenerationRun,
  Post,
  PostEditableField,
  PostsSort,
  PostsSortKey,
} from "@/types";

interface PostsTableProps {
  posts: Post[];
  selectedIds: string[];
  focusedId: string | null;
  openId: string | null;
  pendingIds: string[];
  sort: PostsSort;
  onSort: (key: PostsSortKey) => void;
  onToggleSelect: (id: string) => void;
  onSelectAll: (checked: boolean) => void;
  allSelected: boolean;
  onOpen: (post: Post, tab?: ReviewTab) => void;
  onApprove: (post: Post) => void;
  onReject: (post: Post) => void;
  onRegenerate: (post: Post, target: "caption" | "carousel") => void;
  onDuplicate: (post: Post) => void;
  onDelete: (post: Post) => void;
  onReopen: (post: Post) => void;
  onSaveField: (
    id: string,
    fields: Partial<Pick<Post, PostEditableField>>,
  ) => Promise<unknown>;
  /**
   * The run that produced a post, when one is on record. Preferred over the
   * post's own log because it also carries the stages that were folded into
   * others and the provider attempts behind each one.
   */
  runForPost?: (postId: string) => GenerationRun | null;
}

const COLUMNS: Array<{
  id: string;
  label: string;
  /** Omit for columns that are not worth sorting by. */
  sortKey?: PostsSortKey;
  className?: string;
}> = [
  { id: "post", label: "Post", sortKey: "title", className: "min-w-72" },
  { id: "brandId", label: "Brand" },
  { id: "category", label: "Category" },
  { id: "quality", label: "Quality", sortKey: "quality" },
  { id: "generated", label: "Generated", sortKey: "generated" },
  { id: "scheduled", label: "Scheduled", sortKey: "scheduled" },
  { id: "status", label: "Status", sortKey: "status" },
  { id: "actions", label: "" },
];

/** Clicks on controls inside a row must not also open the review drawer. */
function isInteractive(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    target.closest("button, a, input, textarea, select, [role='menu'], [role='menuitem']") !==
      null
  );
}

export function PostsTable({
  posts,
  selectedIds,
  focusedId,
  openId,
  pendingIds,
  sort,
  onSort,
  onToggleSelect,
  onSelectAll,
  allSelected,
  onOpen,
  onApprove,
  onReject,
  onRegenerate,
  onDuplicate,
  onDelete,
  onReopen,
  onSaveField,
  runForPost,
}: PostsTableProps) {
  /** Which row's generation steps are open. One at a time keeps the table scannable. */
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const baseId = useId();
  const columnCount = COLUMNS.length + 2;

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-card">
      <div className="scrollbar-slim overflow-x-auto">
        <table className="w-full min-w-[70rem] border-collapse text-left">
          <caption className="sr-only">
            Content queue, {posts.length} posts. Use J and K to move between rows.
          </caption>

          <thead className="sticky top-0 z-10 bg-surface-2/95 backdrop-blur-[2px]">
            <tr className="border-b border-line">
              <th scope="col" className="w-10 py-2.5 pl-4">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={(checked) => onSelectAll(checked === true)}
                  aria-label="Select every post on this page"
                />
              </th>

              <th scope="col" className="w-9 py-2.5">
                <span className="sr-only">Generation steps</span>
              </th>

              {COLUMNS.map((column) => {
                const sortable = Boolean(column.sortKey);
                const active = column.sortKey === sort.key;

                return (
                  <th
                    key={column.id}
                    scope="col"
                    aria-sort={
                      active
                        ? sort.direction === "asc"
                          ? "ascending"
                          : "descending"
                        : undefined
                    }
                    className={cn(
                      "px-3 py-2.5 text-[11px] font-medium tracking-[0.06em] text-ink-3 uppercase",
                      column.className,
                    )}
                  >
                    {sortable && column.sortKey ? (
                      <button
                        type="button"
                        onClick={() => onSort(column.sortKey as PostsSortKey)}
                        className="flex items-center gap-1 rounded-sm text-[11px] tracking-[0.06em] text-ink-3 uppercase transition-colors duration-150 ease-soft hover:text-ink"
                      >
                        {column.label}
                        {active ? (
                          sort.direction === "asc" ? (
                            <ArrowUp className="size-3" />
                          ) : (
                            <ArrowDown className="size-3" />
                          )
                        ) : null}
                      </button>
                    ) : (
                      column.label
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {posts.map((post) => {
              const brand = getBrand(post.brandId);
              const selected = selectedIds.includes(post.id);
              const focused = focusedId === post.id;
              const pending = pendingIds.includes(post.id);
              const expanded = expandedId === post.id;
              const run = runForPost?.(post.id) ?? null;
              const stepsId = `${baseId}-${post.id}-steps`;

              return (
                <Fragment key={post.id}>
                <tr
                  data-post-row={post.id}
                  data-focused={focused || undefined}
                  onClick={(event) => {
                    if (isInteractive(event.target)) return;
                    onOpen(post);
                  }}
                  className={cn(
                    "group border-b border-line last:border-b-0 transition-colors duration-150 ease-soft",
                    "hover:bg-surface-2/60",
                    selected && "bg-surface-2",
                    openId === post.id && "bg-surface-2",
                    focused && "ring-1 ring-inset ring-ink/15",
                    pending && "opacity-60",
                  )}
                >
                  <td className="py-3 pl-4 align-middle">
                    <Checkbox
                      checked={selected}
                      onCheckedChange={() => onToggleSelect(post.id)}
                      aria-label={`Select ${post.title}`}
                    />
                  </td>

                  <td className="py-3 align-middle">
                    <DisclosureButton
                      open={expanded}
                      onToggle={() => setExpandedId(expanded ? null : post.id)}
                      label={`${expanded ? "Hide" : "Show"} generation steps for ${post.title}`}
                      controls={stepsId}
                      className={cn(!expanded && "opacity-60 group-hover:opacity-100")}
                    />
                  </td>

                  <td className="px-3 py-3 align-middle">
                    <div className="flex items-center gap-3">
                      <AssetPreview
                        format={post.format}
                        frames={post.assetCount}
                        seed={post.id}
                      />

                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <InlineField
                          value={post.title}
                          label={`Title for ${post.id}`}
                          onSave={(value) => onSaveField(post.id, { title: value })}
                          textClassName="text-[14px] font-medium tracking-[-0.01em] truncate"
                          className="max-w-[26rem]"
                        />

                        <span className="flex items-center gap-2 text-[11.5px] text-ink-3">
                          <span className="font-mono">{post.id}</span>
                          <span aria-hidden="true">·</span>
                          <FormatTag label={FORMAT_LABELS[post.format]} />
                          <span aria-hidden="true">·</span>
                          <span className="truncate">{post.owner}</span>
                          {pending ? (
                            <LoaderCircle
                              className="size-3 animate-spin"
                              aria-label="Saving"
                            />
                          ) : null}
                        </span>
                      </div>
                    </div>
                  </td>

                  <td className="px-3 py-3 align-middle">
                    <span className="flex items-center gap-2 text-[12.5px] text-ink-2">
                      <Image
                        src={brand.logoSrc}
                        alt=""
                        width={16}
                        height={16}
                        className="size-4 rounded-xs"
                      />
                      <span className="truncate">{brand.name}</span>
                    </span>
                  </td>

                  <td className="px-3 py-3 align-middle text-[12.5px] text-ink-2">
                    {post.category}
                  </td>

                  <td className="px-3 py-3 align-middle">
                    <button
                      type="button"
                      onClick={() => onOpen(post, "quality")}
                      className="rounded-sm outline-none"
                      aria-label={`Quality report for ${post.title}`}
                    >
                      <QualityMeter score={post.quality.score} />
                    </button>
                  </td>

                  <td className="px-3 py-3 align-middle text-[12.5px] whitespace-nowrap text-ink-2">
                    {formatRelativeTime(post.generatedAt, MOCK_NOW)}
                  </td>

                  <td className="px-3 py-3 align-middle text-[12.5px] whitespace-nowrap text-ink-2 tnum">
                    {post.scheduledFor ? (
                      formatDateTime(post.scheduledFor)
                    ) : (
                      <span className="text-ink-3">Not scheduled</span>
                    )}
                  </td>

                  <td className="px-3 py-3 align-middle">
                    <StatusCell
                      post={post}
                      onApprove={onApprove}
                      onReject={onReject}
                      onReopen={onReopen}
                      onOpen={onOpen}
                    />
                  </td>

                  <td className="px-3 py-3 align-middle">
                    <span className="flex items-center justify-end gap-1">
                      <QuickDecision
                        post={post}
                        onApprove={onApprove}
                        onReject={onReject}
                        className="opacity-0 transition-opacity duration-150 ease-soft group-hover:opacity-100 focus-within:opacity-100"
                      />
                      <PostActions
                        post={post}
                        onOpen={onOpen}
                        onApprove={onApprove}
                        onReject={onReject}
                        onRegenerate={onRegenerate}
                        onEditCaption={(target) => onOpen(target, "preview")}
                        onEditCarousel={(target) => onOpen(target, "preview")}
                        onDuplicate={onDuplicate}
                        onDelete={onDelete}
                      />
                    </span>
                  </td>
                </tr>

                <tr className={cn(!expanded && "border-b border-line last:border-b-0")}>
                  <td colSpan={columnCount} className="p-0">
                    <Disclosure open={expanded} id={stepsId} className="bg-surface-2/40">
                      <div className="flex flex-col gap-3 border-b border-line px-5 py-4">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-[11px] tracking-[0.06em] text-ink-3 uppercase">
                            How this post was generated
                          </span>
                          <span className="font-mono text-[10.5px] text-ink-3">
                            {post.id}
                          </span>
                          {run?.status === "failed" || post.failureReason ? (
                            <Badge tone="danger" size="sm">
                              failed
                            </Badge>
                          ) : null}
                        </span>

                        <GenerationSteps run={run} logs={post.generationLogs} />

                        <span className="text-[11.5px] text-ink-3">
                          <button
                            type="button"
                            onClick={() => onOpen(post, "logs")}
                            className="rounded-sm underline-offset-4 hover:text-ink hover:underline"
                          >
                            Open the full run in the review drawer
                          </button>
                        </span>
                      </div>
                    </Disclosure>
                  </td>
                </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Status is a control here, not a label: the pipeline can be advanced in place. */
function StatusCell({
  post,
  onApprove,
  onReject,
  onReopen,
  onOpen,
}: {
  post: Post;
  onApprove: (post: Post) => void;
  onReject: (post: Post) => void;
  onReopen: (post: Post) => void;
  onOpen: (post: Post, tab?: ReviewTab) => void;
}) {
  const reviewable = isReviewable(post.status);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Status: ${post.status}. Change status for ${post.title}`}
          className="rounded-full outline-none transition-opacity duration-150 ease-soft hover:opacity-80"
        >
          <StatusBadge status={post.status} size="sm" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Move to</DropdownMenuLabel>
        {reviewable && (
          <DropdownMenuItem onSelect={() => onApprove(post)}>
            Approve · ready to schedule
          </DropdownMenuItem>
        )}
        {!reviewable && (
          <DropdownMenuItem onSelect={() => onReopen(post)}>
            Reopen for review
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => onReject(post)} variant="danger">
          Reject with a note
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onOpen(post, "history")}>
          View version history
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
