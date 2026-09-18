"use client";

import { CalendarClock, Clock, Gauge, ListTree, LoaderCircle } from "lucide-react";
import Image from "next/image";
import { useId, useState } from "react";

import { FormatTag, StatusBadge } from "@/components/content/status-badge";
import { QualityMeter } from "@/components/content/quality-meter";
import { InitialsAvatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Disclosure, DisclosureButton } from "@/components/ui/disclosure";
import { getBrand } from "@/data/brands";
import { MOCK_NOW } from "@/data/time";
import { GenerationSteps } from "@/features/queue/components/generation-steps";
import { InlineField } from "@/features/queue/components/inline-field";
import { PostActions, QuickDecision } from "@/features/queue/components/post-actions";
import type { ReviewTab } from "@/features/queue/components/review-drawer";
import { formatDateTime, formatRelativeTime } from "@/lib/format";
import { FORMAT_LABELS, isReviewable } from "@/lib/status";
import { cn } from "@/lib/utils";
import type { GenerationRun, Post, PostEditableField } from "@/types";

interface PostCardProps {
  post: Post;
  selected: boolean;
  focused: boolean;
  open: boolean;
  pending: boolean;
  onToggleSelect: (id: string) => void;
  onOpen: (post: Post, tab?: ReviewTab) => void;
  onApprove: (post: Post) => void;
  onReject: (post: Post) => void;
  onRegenerate: (post: Post, target: "caption" | "carousel") => void;
  onDuplicate: (post: Post) => void;
  onDelete: (post: Post) => void;
  onSaveField: (
    id: string,
    fields: Partial<Pick<Post, PostEditableField>>,
  ) => Promise<unknown>;
  /** The run that produced this post, when one is on record. */
  run?: GenerationRun | null;
}

export function PostCard({
  post,
  selected,
  focused,
  open,
  pending,
  onToggleSelect,
  onOpen,
  onApprove,
  onReject,
  onRegenerate,
  onDuplicate,
  onDelete,
  onSaveField,
  run = null,
}: PostCardProps) {
  const brand = getBrand(post.brandId);
  const [coverIndex, setCoverIndex] = useState(0);
  const [stepsOpen, setStepsOpen] = useState(false);
  const stepsId = `${useId()}-${post.id}-steps`;
  const reviewable = isReviewable(post.status);
  const cover = post.slides[Math.min(coverIndex, post.slides.length - 1)];

  return (
    <Card
      className={cn(
        "group gap-0 overflow-hidden p-0 transition-[box-shadow,border-color] duration-200 ease-soft",
        "hover:shadow-soft",
        selected && "border-ink/20 bg-surface-2",
        open && "border-ink/20",
        focused && "ring-1 ring-ink/15",
        pending && "opacity-60",
      )}
    >
      <div className="flex items-start gap-3 p-4">
        <Checkbox
          checked={selected}
          onCheckedChange={() => onToggleSelect(post.id)}
          aria-label={`Select ${post.title}`}
          className="mt-0.5"
        />

        <div className="min-w-0 flex-1">
          <InlineField
            value={post.title}
            label={`Title for ${post.id}`}
            onSave={(value) => onSaveField(post.id, { title: value })}
            textClassName="text-[15px] font-medium tracking-[-0.01em]"
            className="w-full"
          />
          <span className="mt-1 flex items-center gap-2 text-[11.5px] text-ink-3">
            <Image
              src={brand.logoSrc}
              alt=""
              width={14}
              height={14}
              className="size-3.5 rounded-xs"
            />
            <span className="truncate">{brand.name}</span>
            <span aria-hidden="true">·</span>
            <span>{post.category}</span>
            {pending ? <LoaderCircle className="size-3 animate-spin" aria-label="Saving" /> : null}
          </span>
        </div>

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
      </div>

      {/* Cover: the first slide, with the rest of the stack one click away. */}
      <button
        type="button"
        onClick={() => onOpen(post, "preview")}
        aria-label={`Preview carousel for ${post.title}`}
        className="relative mx-4 flex aspect-[16/10] flex-col justify-between overflow-hidden rounded-lg border border-line bg-surface-2 p-4 text-left outline-none transition-colors duration-150 ease-soft hover:bg-surface-3"
      >
        <span className="flex items-center justify-between gap-3 text-[11px] text-ink-3">
          <span className="font-mono tracking-[0.06em] uppercase">
            {cover.kicker || FORMAT_LABELS[post.format]}
          </span>
          <span className="font-mono tracking-[0.06em] uppercase tnum">
            {coverIndex + 1}/{post.slides.length}
          </span>
        </span>

        <span className="flex flex-col gap-1.5">
          <span className="text-[17px] leading-tight font-medium tracking-[-0.02em] text-ink">
            {cover.headline}
          </span>
          <span className="line-clamp-2 text-[12.5px] leading-relaxed text-ink-2">
            {cover.body}
          </span>
        </span>

        <span aria-hidden="true" className="absolute inset-x-4 bottom-3 flex gap-1">
          {post.slides.map((slide, index) => (
            <span
              key={slide.id}
              className={cn(
                "h-0.5 flex-1 rounded-full",
                index === coverIndex ? "bg-ink/70" : "bg-line-strong",
              )}
            />
          ))}
        </span>
      </button>

      <div className="flex items-center gap-1 px-4 pt-2">
        {post.slides.map((slide, index) => (
          <button
            key={slide.id}
            type="button"
            onClick={() => setCoverIndex(index)}
            aria-label={`Show slide ${index + 1} cover`}
            aria-current={index === coverIndex}
            className={cn(
              "rounded-sm px-1.5 py-1 text-[11px] tnum transition-colors duration-150 ease-soft",
              index === coverIndex ? "text-ink" : "text-ink-3 hover:text-ink-2",
            )}
          >
            {index + 1}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 pt-3 text-[12px] text-ink-2">
        <span className="flex items-center gap-1.5">
          <Gauge className="size-3.5 text-ink-3" aria-hidden="true" />
          <QualityMeter score={post.quality.score} />
        </span>
        <span className="flex items-center gap-1.5">
          <Clock className="size-3.5 text-ink-3" aria-hidden="true" />
          {formatRelativeTime(post.generatedAt, MOCK_NOW)}
        </span>
        <span className="flex items-center gap-1.5">
          <CalendarClock className="size-3.5 text-ink-3" aria-hidden="true" />
          {post.scheduledFor ? formatDateTime(post.scheduledFor) : "Not scheduled"}
        </span>
      </div>

      {/* The pipeline that produced this card, one click away. */}
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-line px-4 py-2.5">
        <button
          type="button"
          onClick={() => setStepsOpen(!stepsOpen)}
          aria-expanded={stepsOpen}
          aria-controls={stepsId}
          className="flex items-center gap-1.5 rounded-full px-2 py-1 text-[12px] text-ink-3 outline-none transition-colors duration-150 ease-soft hover:bg-surface-2 hover:text-ink"
        >
          <ListTree className="size-3.5" aria-hidden="true" />
          {stepsOpen ? "Hide" : "Show"} generation steps
          <span className="tnum">
            ({run?.steps.length ?? post.generationLogs.length})
          </span>
        </button>

        <DisclosureButton
          open={stepsOpen}
          onToggle={() => setStepsOpen(!stepsOpen)}
          label={`${stepsOpen ? "Hide" : "Show"} generation steps for ${post.title}`}
          controls={stepsId}
        />
      </div>

      <Disclosure open={stepsOpen} id={stepsId} className="border-t border-line bg-surface-2/40">
        <div className="px-4 py-4">
          <GenerationSteps run={run} logs={post.generationLogs} density="compact" />
        </div>
      </Disclosure>

      <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3">
        <span className="flex min-w-0 items-center gap-2 text-[12px] text-ink-3">
          <InitialsAvatar
            initials={post.owner
              .split(" ")
              .map((part) => part[0])
              .join("")
              .slice(0, 2)}
            size="xs"
            label={post.owner}
          />
          <span className="truncate">{post.owner}</span>
          <FormatTag label={FORMAT_LABELS[post.format]} />
        </span>

        <span className="flex shrink-0 items-center gap-1.5">
          {reviewable ? (
            <QuickDecision
              post={post}
              onApprove={onApprove}
              onReject={onReject}
              className="opacity-0 transition-opacity duration-150 ease-soft group-hover:opacity-100 focus-within:opacity-100"
            />
          ) : null}
          <StatusBadge status={post.status} size="sm" />
        </span>
      </div>
    </Card>
  );
}
