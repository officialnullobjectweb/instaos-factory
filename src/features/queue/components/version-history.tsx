"use client";

import { ArrowRight, Bot, History, RefreshCw, RotateCcw, SquarePen } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { DiffSegment } from "@/lib/diff";
import { formatDateTime, formatRelativeTime } from "@/lib/format";
import {
  compareVersions,
  versionsDescending,
  VERSION_SOURCE_LABELS,
} from "@/lib/posts/versions";
import { cn } from "@/lib/utils";
import { MOCK_NOW } from "@/data/time";
import type { FieldDiff, SlideChange } from "@/lib/posts/versions";
import type { Post, PostVersion, VersionSource } from "@/types";

const SOURCE_ICONS: Record<VersionSource, LucideIcon> = {
  generation: Bot,
  edit: SquarePen,
  regeneration: RefreshCw,
};

interface VersionHistoryProps {
  post: Post;
  /** Restores a snapshot into the live post (as a new version). */
  onRestore?: (version: PostVersion) => void;
  className?: string;
  /** Highlights a version, e.g. the one that just landed. */
  highlightId?: string | null;
}

export function VersionHistory({
  post,
  onRestore,
  className,
  highlightId,
}: VersionHistoryProps) {
  const versions = useMemo(() => versionsDescending(post.versions), [post.versions]);

  // Default pairing: the two most recent versions, which is what a reviewer
  // wants nine times out of ten — what changed in the last pass.
  const [selection, setSelection] = useState<string[]>(() =>
    versions.slice(0, 2).map((version) => version.id),
  );

  useEffect(() => {
    setSelection(versions.slice(0, 2).map((version) => version.id));
  }, [post.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const [from, to] = selection
    .map((id) => versions.find((version) => version.id === id))
    .sort((a, b) => (a?.number ?? 0) - (b?.number ?? 0));

  const comparison = from && to && from.id !== to.id ? compareVersions(from, to) : null;

  function toggle(id: string) {
    setSelection((current) => {
      if (current.includes(id)) {
        return current.filter((candidate) => candidate !== id);
      }
      if (current.length < 2) return [...current, id];
      return [current[1], id];
    });
  }

  return (
    <div className={cn("flex flex-col gap-5", className)}>
      <section className="flex flex-col gap-2">
        <header className="flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-[13px] font-medium text-ink">
            <History className="size-3.5 text-ink-3" />
            {versions.length} {versions.length === 1 ? "version" : "versions"}
          </h3>
          <p className="text-[12px] text-ink-3">
            Pick two to compare — every edit, regeneration and restore is kept.
          </p>
        </header>

        <ul className="flex flex-col divide-y divide-line rounded-lg border border-line">
          {versions.map((version) => {
            const selected = selection.includes(version.id);
            const Icon = SOURCE_ICONS[version.source];
            const role =
              selected && from?.id === version.id
                ? "Base"
                : selected && to?.id === version.id
                  ? "Compare"
                  : null;

            return (
              <li key={version.id}>
                <button
                  type="button"
                  onClick={() => toggle(version.id)}
                  aria-pressed={selected}
                  className={cn(
                    "flex w-full items-start gap-3 px-3.5 py-3 text-left outline-none transition-colors duration-150 ease-soft",
                    selected ? "bg-surface-2" : "hover:bg-surface-2/60",
                    highlightId === version.id && "ring-1 ring-inset ring-ink/15",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-medium tnum",
                      selected
                        ? "border-ink bg-ink text-canvas"
                        : "border-line-strong text-ink-3",
                    )}
                  >
                    {version.number}
                  </span>

                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-[13px] font-medium text-ink">
                        {version.label}
                      </span>
                      <Badge tone="neutral" size="sm">
                        <Icon className="size-3" />
                        {VERSION_SOURCE_LABELS[version.source]}
                      </Badge>
                      {role ? (
                        <Badge tone={role === "Base" ? "outline" : "accent-outline"} size="sm">
                          {role}
                        </Badge>
                      ) : null}
                    </span>

                    <span className="truncate text-[12.5px] text-ink-2">
                      {version.summary}
                    </span>

                    <span className="flex flex-wrap items-center gap-2 text-[11.5px] text-ink-3">
                      <span>{version.author}</span>
                      <span aria-hidden="true">·</span>
                      <span>{formatRelativeTime(version.createdAt, MOCK_NOW)}</span>
                      <span aria-hidden="true">·</span>
                      <span className="tnum">{formatDateTime(version.createdAt)}</span>
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {comparison ? (
        <section className="flex flex-col gap-4">
          <header className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
            <h3 className="flex items-center gap-2 text-[13px] font-medium text-ink">
              Comparing V{comparison.from.number}
              <ArrowRight className="size-3.5 text-ink-3" />
              V{comparison.to.number}
              <span className="font-normal text-ink-3 tnum">
                {comparison.totalChanges === 0
                  ? "no changes"
                  : `${comparison.totalChanges} ${
                      comparison.totalChanges === 1 ? "change" : "changes"
                    }`}
              </span>
            </h3>

            {onRestore ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => onRestore(comparison.to)}
              >
                <RotateCcw />
                Restore V{comparison.to.number}
              </Button>
            ) : null}
          </header>

          <div className="flex flex-col gap-4">
            {comparison.title.changed ? (
              <DiffBlock label="Title" diff={comparison.title} />
            ) : null}
            <DiffBlock label="Caption" diff={comparison.caption} />
            <DiffBlock label="Alt text" diff={comparison.altText} />

            <div className="flex flex-col gap-2">
              <DiffLabel label="Hashtags" changed={comparison.hashtags.added.length + comparison.hashtags.removed.length > 0} />
              <div className="flex flex-wrap gap-1.5">
                {comparison.hashtags.added.map((tag) => (
                  <span
                    key={`add-${tag}`}
                    className="rounded-full border border-success/25 bg-success-soft px-2 py-0.5 text-[11.5px] text-success"
                  >
                    + {tag}
                  </span>
                ))}
                {comparison.hashtags.removed.map((tag) => (
                  <span
                    key={`remove-${tag}`}
                    className="rounded-full border border-danger/20 bg-danger-soft px-2 py-0.5 text-[11.5px] text-danger line-through"
                  >
                    {tag}
                  </span>
                ))}
                {comparison.hashtags.added.length === 0 &&
                comparison.hashtags.removed.length === 0 ? (
                  <span className="text-[12.5px] text-ink-3">
                    Unchanged — {comparison.hashtags.unchanged.length} tags carried over.
                  </span>
                ) : null}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <DiffLabel
                label={`Slides · ${comparison.slides.before} → ${comparison.slides.after}`}
                changed={comparison.slides.changes.length > 0}
              />
              {comparison.slides.changes.length === 0 ? (
                <span className="text-[12.5px] text-ink-3">
                  The slide stack is identical between these versions.
                </span>
              ) : (
                <ul className="flex flex-col gap-2">
                  {comparison.slides.changes.map((change) => (
                    <SlideChangeRow key={`${change.kind}-${change.index}`} change={change} />
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      ) : (
        <p className="border-t border-line pt-4 text-[12.5px] text-ink-3">
          Select two versions above to see exactly what changed between them.
        </p>
      )}
    </div>
  );
}

function DiffLabel({ label, changed }: { label: string; changed: boolean }) {
  return (
    <span className="flex items-center gap-2 text-[11px] tracking-[0.06em] text-ink-3 uppercase">
      {label}
      {changed ? (
        <span className="size-1.5 rounded-full bg-warning" aria-label="changed" />
      ) : null}
    </span>
  );
}

function DiffBlock({ label, diff }: { label: string; diff: FieldDiff }) {
  return (
    <div className="flex flex-col gap-2">
      <DiffLabel label={label} changed={diff.changed} />
      <p className="rounded-lg border border-line bg-surface-2 p-3 text-[12.5px] leading-relaxed">
        <DiffText segments={diff.segments} />
      </p>
    </div>
  );
}

/** Word-level diff rendered inline: additions are underlined, removals struck. */
function DiffText({ segments }: { segments: DiffSegment[] }) {
  return (
    <>
      {segments.map((segment, index) => (
        <span
          key={`${segment.type}-${index}`}
          className={cn(
            segment.type === "same" && "text-ink-2",
            segment.type === "add" && "bg-success-soft text-success",
            segment.type === "remove" && "bg-danger-soft text-danger line-through",
          )}
        >
          {segment.text}
        </span>
      ))}
    </>
  );
}

function SlideChangeRow({ change }: { change: SlideChange }) {
  const label =
    change.kind === "added"
      ? `Slide ${change.index + 1} added`
      : change.kind === "removed"
        ? `Slide ${change.index + 1} removed`
        : `Slide ${change.index + 1} edited`;

  return (
    <li className="flex flex-col gap-1.5 rounded-lg border border-line p-3">
      <span className="flex items-center gap-2 text-[12.5px] font-medium text-ink">
        <Badge
          tone={
            change.kind === "removed"
              ? "danger-outline"
              : change.kind === "added"
                ? "success-outline"
                : "neutral"
          }
          size="sm"
        >
          {label}
        </Badge>
        {change.fields.length > 0 ? (
          <span className="text-[11.5px] text-ink-3">
            {change.fields.join(", ")}
          </span>
        ) : null}
      </span>

      {change.before ? (
        <span className="text-[12.5px] text-ink-3 line-through">
          {change.before.headline}
        </span>
      ) : null}
      {change.after ? (
        <span className="text-[12.5px] text-ink">{change.after.headline}</span>
      ) : null}
    </li>
  );
}
