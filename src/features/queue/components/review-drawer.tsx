"use client";

import {
  BookOpen,
  CalendarClock,
  Check,
  Clock,
  History,
  Eye,
  Gauge,
  Info,
  ScrollText,
  TriangleAlert,
  UserRound,
  X,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";

import { FormatTag, StatusBadge } from "@/components/content/status-badge";
import { QualityMeter } from "@/components/content/quality-meter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetBody, SheetContent, SheetFooter } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getBrand } from "@/data/brands";
import { MOCK_NOW } from "@/data/time";
import { CarouselPreview } from "@/features/queue/components/carousel-preview";
import { GenerationSteps } from "@/features/queue/components/generation-steps";
import { HashtagEditor } from "@/features/queue/components/hashtag-editor";
import { InlineField } from "@/features/queue/components/inline-field";
import { PostActions } from "@/features/queue/components/post-actions";
import { QualityReport } from "@/features/queue/components/quality-report";
import { SourceList } from "@/features/queue/components/source-list";
import { VersionHistory } from "@/features/queue/components/version-history";
import { formatDateTime, formatRelativeTime } from "@/lib/format";
import { CONTENT_STATUS_META, FORMAT_LABELS, isReviewable } from "@/lib/status";
import { cn } from "@/lib/utils";
import type {
  ContentStatus,
  GenerationRun,
  Post,
  PostEditableField,
  PostVersion,
} from "@/types";

export type ReviewTab = "preview" | "quality" | "sources" | "logs" | "history";

interface ReviewDrawerProps {
  /** The post to review, or null when the drawer is closed. */
  post: Post | null;
  initialTab?: ReviewTab;
  onOpenChange: (open: boolean) => void;
  onApprove: (post: Post) => void;
  onReject: (post: Post) => void;
  onRegenerate: (post: Post, target: "caption" | "carousel") => void;
  onDuplicate: (post: Post) => void;
  onDelete: (post: Post) => void;
  onRestoreVersion: (post: Post, version: PostVersion) => void;
  onSaveFields: (
    id: string,
    fields: Partial<Pick<Post, PostEditableField>>,
    options?: { commit?: boolean; summary?: string },
  ) => Promise<unknown>;
  /** Ids with an in-flight write, used to disable the action bar. */
  pending: boolean;
  /** The run that produced this post, when one is on record. */
  run?: GenerationRun | null;
}

/**
 * The whole post in one panel: what it looks like, why it scored what it scored,
 * where the facts came from, how it was produced — and every action a reviewer
 * can take, without leaving the queue.
 */
export function ReviewDrawer({
  post,
  initialTab = "preview",
  onOpenChange,
  onApprove,
  onReject,
  onRegenerate,
  onDuplicate,
  onDelete,
  onRestoreVersion,
  onSaveFields,
  pending,
  run = null,
}: ReviewDrawerProps) {
  const [tab, setTab] = useState<ReviewTab>(initialTab);
  const [lastPost, setLastPost] = useState<Post | null>(post);
  const [slideStatus, setSlideStatus] = useState<Record<number, "accepted" | "rejected">>({});

  // Keeps the panel populated through its closing animation.
  useEffect(() => {
    if (post) setLastPost(post);
  }, [post]);

  const shown = post ?? lastPost;
  const open = Boolean(post);

  useEffect(() => {
    if (post) {
      setTab(initialTab);
      setSlideStatus({});
    }
  }, [post?.id, initialTab]); // eslint-disable-line react-hooks/exhaustive-deps

  const reviewable = shown ? isReviewable(shown.status) : false;

  const handleAcceptSlide = (slideIndex: number) => {
    setSlideStatus(prev => ({
      ...prev,
      [slideIndex]: prev[slideIndex] === "accepted" ? undefined! : "accepted",
    }));
  };

  const handleRejectSlide = (slideIndex: number) => {
    setSlideStatus(prev => ({
      ...prev,
      [slideIndex]: prev[slideIndex] === "rejected" ? undefined! : "rejected",
    }));
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-[min(48rem,100vw)] p-0"
        aria-label={shown ? `Review ${shown.title}` : "Review post"}
      >
        {shown ? (
          <>
            <header className="flex shrink-0 items-start gap-3 border-b border-line px-5 py-4">
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <span className="flex items-center gap-2 text-[11.5px] text-ink-3">
                  <Image
                    src={getBrand(shown.brandId).logoSrc}
                    alt=""
                    width={14}
                    height={14}
                    className="size-3.5 rounded-xs"
                  />
                  <span className="text-ink-2">{getBrand(shown.brandId).name}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono">{shown.id}</span>
                  <span aria-hidden="true">·</span>
                  <FormatTag label={FORMAT_LABELS[shown.format]} />
                  <span aria-hidden="true">·</span>
                  <span>{shown.category}</span>
                </span>

                <InlineField
                  value={shown.title}
                  label="Post title"
                  onSave={(value) => onSaveFields(shown.id, { title: value })}
                  onCommit={(value, summary) =>
                    onSaveFields(shown.id, { title: value }, { commit: true, summary })
                  }
                  textClassName="text-[19px] leading-snug font-medium tracking-[-0.02em]"
                  className="max-w-full"
                />

                <span className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={shown.status} size="sm" />
                  <QualityMeter score={shown.quality.score} showVerdict />
                  <span className="flex items-center gap-1.5 text-[12px] text-ink-3">
                    <Clock className="size-3.5" aria-hidden="true" />
                    generated {formatRelativeTime(shown.generatedAt, MOCK_NOW)}
                  </span>
                </span>
              </div>

              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Close review drawer"
                onClick={() => onOpenChange(false)}
              >
                <X />
              </Button>
            </header>

            <Tabs
              value={tab}
              onValueChange={(value) => setTab(value as ReviewTab)}
              className="flex min-h-0 flex-1 flex-col"
            >
              <div className="shrink-0 border-b border-line px-5 py-2.5">
                <TabsList className="w-full justify-start overflow-x-auto">
                  <TabsTrigger value="preview">
                    <Eye className="size-3.5" />
                    Preview
                  </TabsTrigger>
                  <TabsTrigger value="quality">
                    <Check className="size-3.5" />
                    Quality
                  </TabsTrigger>
                  <TabsTrigger value="sources">
                    <BookOpen className="size-3.5" />
                    {shown.sources.length} sources
                  </TabsTrigger>
                  <TabsTrigger value="logs">
                    <ScrollText className="size-3.5" />
                    Logs
                  </TabsTrigger>
                  <TabsTrigger value="history">
                    <History className="size-3.5" />
                    {shown.versions.length} versions
                  </TabsTrigger>
                </TabsList>
              </div>

              <SheetBody className="px-5 py-4">
                <TabsContent value="preview" className="flex flex-col gap-6">
                  {shown.slides.length > 0 ? (
                    <section className="flex flex-col gap-3">
                      <SectionLabel
                        label="Carousel"
                        hint={`${shown.slides.length} slides · edit any slide in place`}
                      />
                      <CarouselPreview
                        slides={shown.slides}
                        onSaveSlide={(slides) =>
                          onSaveFields(shown.id, { slides })
                        }
                        onCommitSlide={(slides) =>
                          onSaveFields(
                            shown.id,
                            { slides },
                            { commit: true, summary: "Edited a carousel slide" },
                          )
                        }
                        onAcceptSlide={handleAcceptSlide}
                        onRejectSlide={handleRejectSlide}
                        slideStatus={slideStatus}
                      />
                    </section>
                  ) : null}

                  <section className="flex flex-col gap-2">
                    <SectionLabel label="Caption" hint="Autosaves as you type" />
                    <InlineField
                      value={shown.caption}
                      label="Caption"
                      placeholder="Write the caption…"
                      multiline
                      onSave={(value) => onSaveFields(shown.id, { caption: value })}
                      onCommit={(value, summary) =>
                        onSaveFields(shown.id, { caption: value }, { commit: true, summary })
                      }
                      textClassName="text-[13.5px] leading-relaxed text-ink-2"
                      className="w-full"
                    />
                    <p className="text-[11.5px] text-ink-3 tnum">
                      {shown.caption.split(/\s+/).filter(Boolean).length} words ·{" "}
                      {shown.caption.length}/2 200 characters
                    </p>
                  </section>

                  <section className="flex flex-col gap-2">
                    <SectionLabel
                      label="Hashtags"
                      hint={`${shown.hashtags.length} tags`}
                    />
                    <HashtagEditor
                      hashtags={shown.hashtags}
                      onSave={(hashtags) => onSaveFields(shown.id, { hashtags })}
                      onCommit={(hashtags, summary) =>
                        onSaveFields(
                          shown.id,
                          { hashtags },
                          { commit: true, summary },
                        )
                      }
                    />
                  </section>

                  <section className="flex flex-col gap-2">
                    <SectionLabel
                      label="Alt text"
                      hint="Read aloud by screen readers on every frame"
                    />
                    <InlineField
                      value={shown.altText}
                      label="Alt text"
                      placeholder="Describe the carousel…"
                      multiline
                      onSave={(value) => onSaveFields(shown.id, { altText: value })}
                      onCommit={(value, summary) =>
                        onSaveFields(shown.id, { altText: value }, { commit: true, summary })
                      }
                      textClassName="text-[13px] leading-relaxed text-ink-2"
                      className="w-full"
                    />
                  </section>

                  <section className="flex flex-col gap-2">
                    <SectionLabel label="Metadata" />
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border border-line bg-surface-2 p-3.5">
                      <MetaRow
                        icon={CalendarClock}
                        label="Generated"
                        value={formatDateTime(shown.generatedAt)}
                      />
                      <MetaRow
                        icon={CalendarClock}
                        label="Scheduled"
                        value={
                          shown.scheduledFor
                            ? formatDateTime(shown.scheduledFor)
                            : "Not scheduled"
                        }
                      />
                      <MetaRow icon={UserRound} label="Owner" value={shown.owner} />
                      <MetaRow
                        icon={Gauge}
                        label="Quality"
                        value={`${shown.quality.score} · ${shown.quality.verdict}`}
                      />
                      <MetaRow
                        icon={ScrollText}
                        label="Template"
                        value={shown.templateId}
                        mono
                      />
                      <MetaRow
                        icon={Clock}
                        label="Publish retries"
                        value={String(shown.retryCount)}
                      />
                      <MetaRow
                        icon={Info}
                        label="Last updated"
                        value={formatDateTime(shown.updatedAt)}
                      />
                      <MetaRow
                        icon={History}
                        label="Tags"
                        value={shown.tags.length > 0 ? shown.tags.join(", ") : "—"}
                      />
                    </dl>
                  </section>

                  {shown.failureReason ? (
                    <Notice tone="danger" title="Last publish failed">
                      {shown.failureReason}
                    </Notice>
                  ) : null}

                  {shown.reviewNote ? (
                    <Notice tone="warning" title="Reviewer note">
                      {shown.reviewNote}
                    </Notice>
                  ) : null}
                </TabsContent>

                <TabsContent value="quality">
                  <QualityReport report={shown.quality} />
                </TabsContent>

                <TabsContent value="sources">
                  <SourceList sources={shown.sources} />
                </TabsContent>

                <TabsContent value="logs">
                  <GenerationSteps run={run} logs={shown.generationLogs} />
                </TabsContent>

                <TabsContent value="history">
                  <VersionHistory
                    post={shown}
                    onRestore={(version) => onRestoreVersion(shown, version)}
                  />
                </TabsContent>
              </SheetBody>
            </Tabs>

            <SheetFooter className="justify-between gap-3 px-5">
              <span className="hidden items-center gap-3 text-[11px] text-ink-3 sm:flex">
                <kbd className="rounded-xs border border-line bg-surface-2 px-1 font-mono">
                  A
                </kbd>
                approve
                <kbd className="rounded-xs border border-line bg-surface-2 px-1 font-mono">
                  R
                </kbd>
                reject
              </span>

              <span className="flex items-center gap-2">
                <PostActions
                  post={shown}
                  onApprove={onApprove}
                  onReject={onReject}
                  onRegenerate={onRegenerate}
                  onEditCaption={() => setTab("preview")}
                  onEditCarousel={() => setTab("preview")}
                  onDuplicate={onDuplicate}
                  onDelete={onDelete}
                  trigger={
                    <Button variant="ghost" size="sm">
                      More actions
                    </Button>
                  }
                />

                {reviewable ? (
                  <Button variant="secondary" size="sm" onClick={() => onReject(shown)}>
                    <X />
                    Reject
                  </Button>
                ) : (
                  <StatusNote status={shown.status} />
                )}

                <Button
                  variant="primary"
                  size="sm"
                  disabled={pending || !reviewable}
                  onClick={() => onApprove(shown)}
                >
                  <Check strokeWidth={2.4} />
                  Approve
                </Button>
              </span>
            </SheetFooter>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

/** Read-only status for posts that no longer await a decision. */
function StatusNote({ status }: { status: ContentStatus }) {
  const meta = CONTENT_STATUS_META[status];
  return (
    <Badge tone={meta.tone} size="md">
      {meta.label}
    </Badge>
  );
}

function SectionLabel({ label, hint }: { label: string; hint?: string }) {
  return (
    <span className="flex flex-wrap items-baseline justify-between gap-2">
      <span className="text-[11px] font-medium tracking-[0.06em] text-ink-3 uppercase">
        {label}
      </span>
      {hint ? <span className="text-[11.5px] text-ink-3">{hint}</span> : null}
    </span>
  );
}

function MetaRow({
  icon: Icon,
  label,
  value,
  mono = false,
}: {
  icon: typeof Clock;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="flex items-center gap-1.5 text-[11px] tracking-[0.06em] text-ink-3 uppercase">
        <Icon className="size-3" aria-hidden="true" />
        {label}
      </dt>
      <dd
        className={cn(
          "truncate text-[12.5px] text-ink",
          mono ? "font-mono text-[11.5px]" : "tnum",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function Notice({
  tone,
  title,
  children,
}: {
  tone: "danger" | "warning";
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 rounded-lg border p-3.5",
        tone === "danger"
          ? "border-danger/20 bg-danger-soft"
          : "border-warning/20 bg-warning-soft",
      )}
    >
      <span
        className={cn(
          "flex items-center gap-2 text-[12px] font-medium",
          tone === "danger" ? "text-danger" : "text-warning",
        )}
      >
        <TriangleAlert className="size-3.5" />
        {title}
      </span>
      <p
        className={cn(
          "text-[12.5px] leading-relaxed",
          tone === "danger" ? "text-danger" : "text-warning",
        )}
      >
        {children}
      </p>
    </div>
  );
}
