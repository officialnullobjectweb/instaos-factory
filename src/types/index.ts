/* -------------------------------------------------------------------------- */
/*  AI engine                                                                 */
/* -------------------------------------------------------------------------- */

/* Types only — the AI module has no runtime imports of its own. */
export type * from "./ai";

export type { AiLogStep } from "./ai";

/* -------------------------------------------------------------------------- */
/*  Scheduling, publishing and audit                                          */
/* -------------------------------------------------------------------------- */

export type * from "./schedule";

/* -------------------------------------------------------------------------- */
/*  Instagram publishing                                                      */
/* -------------------------------------------------------------------------- */

export type * from "./instagram";

/* -------------------------------------------------------------------------- */
/*  Insights and the learning engine                                          */
/* -------------------------------------------------------------------------- */

export type * from "./insights";

/* -------------------------------------------------------------------------- */
/*  Brands                                                                    */
/* -------------------------------------------------------------------------- */

export type BrandId = "midnight-ritual" | "studio-noir" | "daily-grind";

export type BrandStatus = "active" | "paused";

/** Monochrome-leaning palette the carousel generator composes against. */
export interface BrandColorTheme {
  background: string;
  foreground: string;
  accent: string;
}

/**
 * A brand is more than a name: it is the brief the generation engine reads.
 * Voice, style, reading level, palette and pillars all feed the prompt library,
 * which is why they live on the brand rather than being duplicated in prompts.
 */
export interface Brand {
  id: BrandId;
  name: string;
  handle: string;
  /** Short mark used in avatars and monochrome thumbnails. */
  initials: string;
  positioning: string;
  followers: number;
  followerGrowth: number;
  postsThisWeek: number;
  avgEngagement: number;
  status: BrandStatus;
  logoSrc: string;
  /** The content category this brand publishes in. */
  category: PostCategory;
  voice: string;
  writingStyle: string;
  readingLevel: string;
  colorTheme: BrandColorTheme;
  contentPillars: string[];
  /** Hashtags every post from this brand carries, before topic-specific tags. */
  hashtagBase: string[];
  /** Preferred publishing window, used when a generated post needs a slot. */
  postingWindow: { weekday: number; hourUtc: number };
}

/* -------------------------------------------------------------------------- */
/*  Content lifecycle                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Every post moves through this pipeline. `failed` is a terminal publish error
 * that can be retried; `rejected` is a human decision that returns work to the
 * author. Both keep their own note field so the reason is never lost.
 */
export type ContentStatus =
  | "draft"
  | "pending_review"
  | "approved"
  | "scheduled"
  | "published"
  | "failed"
  | "rejected";

export type ContentFormat = "reel" | "carousel" | "static" | "story";

export type ContentPriority = "low" | "normal" | "high";

export interface ContentMetrics {
  reach: number;
  likes: number;
  comments: number;
  saves: number;
  engagementRate: number;
}

export interface ContentItem {
  id: string;
  title: string;
  caption: string;
  brandId: BrandId;
  templateId: string;
  status: ContentStatus;
  format: ContentFormat;
  priority: ContentPriority;
  /** ISO timestamp, null until the item is scheduled. */
  scheduledFor: string | null;
  createdAt: string;
  updatedAt: string;
  /** Kept in sync with `slides.length` by the repository. */
  assetCount: number;
  /** Topical tags (the hashtags are stored separately). */
  tags: string[];
  owner: string;
  metrics?: ContentMetrics;
  /** Reason a reviewer sent the item back. */
  reviewNote?: string;
}

/* -------------------------------------------------------------------------- */
/*  Posts (superset of ContentItem — the queue's unit of work)                 */
/* -------------------------------------------------------------------------- */

export type PostCategory = "Geography" | "Psychology" | "Branding";

export type SlideKind =
  | "cover"
  | "statement"
  | "list"
  | "statistic"
  | "quote"
  | "cta";

export interface Slide {
  id: string;
  index: number;
  kind: SlideKind;
  kicker: string;
  headline: string;
  body: string;
  footnote?: string;
}

export type QualityVerdict = "excellent" | "strong" | "review" | "weak";

export interface QualityCriterion {
  id: string;
  label: string;
  /** 0–100. */
  score: number;
  /** Share of the overall score, 0–1. */
  weight: number;
  note: string;
}

export interface QualityReport {
  /** Weighted overall score, 0–100. */
  score: number;
  verdict: QualityVerdict;
  summary: string;
  criteria: QualityCriterion[];
  /** Issues a reviewer must resolve before approving. */
  blockers: string[];
}

export type SourceCredibility = "high" | "medium" | "low";

export interface SourceRef {
  id: string;
  title: string;
  publisher: string;
  url: string;
  credibility: SourceCredibility;
  accessedAt: string;
}

export type GenerationStep =
  | "brief"
  | "research"
  | "verify"
  | "caption"
  | "carousel"
  | "hashtags"
  | "alt_text"
  | "quality"
  | "schedule";

export type GenerationLogStatus = "success" | "warning" | "error" | "running";

export interface GenerationLogEntry {
  id: string;
  step: GenerationStep;
  status: GenerationLogStatus;
  message: string;
  durationMs: number;
  timestamp: string;
  model: string;
  tokens: number;
}

/** The editable surface of a post — what a version captures. */
export interface PostSnapshot {
  title: string;
  caption: string;
  hashtags: string[];
  altText: string;
  slides: Slide[];
}

export type VersionSource = "generation" | "edit" | "regeneration";

export interface PostVersion {
  id: string;
  number: number;
  label: string;
  createdAt: string;
  author: string;
  source: VersionSource;
  /** One-line description of what changed in this version. */
  summary: string;
  snapshot: PostSnapshot;
}

export interface Post extends ContentItem {
  category: PostCategory;
  quality: QualityReport;
  slides: Slide[];
  hashtags: string[];
  altText: string;
  sources: SourceRef[];
  generationLogs: GenerationLogEntry[];
  /** Newest last. Version 1 is always the original generation. */
  versions: PostVersion[];
  generatedAt: string;
  publishedAt: string | null;
  /** Populated only when `status === "failed"`. */
  failureReason: string | null;
  retryCount: number;
}

/** Payload accepted by the repository when creating a post. */
export type PostDraft = Omit<Post, "id" | "createdAt" | "updatedAt">;

/** Fields a reviewer can change inline. */
export type PostEditableField =
  | "title"
  | "caption"
  | "hashtags"
  | "altText"
  | "slides";

/* -------------------------------------------------------------------------- */
/*  Queue query model                                                         */
/* -------------------------------------------------------------------------- */

export type DateRangeKey = "any" | "today" | "week" | "month" | "custom";

export interface PostsFilters {
  search: string;
  brandId: BrandId | "all";
  status: ContentStatus | "all";
  category: PostCategory | "all";
  format: ContentFormat | "all";
  dateRange: DateRangeKey;
  /** Inclusive minimum quality score. */
  minQuality: number;
  /** Inclusive custom range, only used when `dateRange === "custom"`. */
  customFrom: string | null;
  customTo: string | null;
}

export const EMPTY_POST_FILTERS: PostsFilters = {
  search: "",
  brandId: "all",
  status: "all",
  category: "all",
  format: "all",
  dateRange: "any",
  minQuality: 0,
  customFrom: null,
  customTo: null,
};

export type PostsSortKey =
  | "quality"
  | "generated"
  | "scheduled"
  | "updated"
  | "title"
  | "status";

export interface PostsSort {
  key: PostsSortKey;
  direction: SortDirection;
}

export type QueueViewMode = "table" | "cards";

/* -------------------------------------------------------------------------- */
/*  Templates                                                                 */
/* -------------------------------------------------------------------------- */

export type TemplateCategory =
  | "Editorial"
  | "Product"
  | "Story"
  | "Carousel"
  | "Announcement";

export interface Template {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  format: ContentFormat;
  brandIds: BrandId[];
  uses: number;
  updatedAt: string;
  status: "live" | "draft" | "archived";
  /** Monochrome preview lines rendered by the template card. */
  preview: string[];
}

/* -------------------------------------------------------------------------- */
/*  Schedule & calendar                                                       */
/* -------------------------------------------------------------------------- */

export interface ScheduleSlot {
  id: string;
  brandId: BrandId;
  contentId: string;
  startsAt: string;
  durationMinutes: number;
  status: ContentStatus;
}

/* -------------------------------------------------------------------------- */
/*  Activity, notifications, health                                           */
/* -------------------------------------------------------------------------- */

export type ActivityKind =
  | "approval"
  | "rejection"
  | "schedule"
  | "publish"
  | "generation"
  | "comment"
  | "failure"
  | "system";

export interface ActivityEvent {
  id: string;
  kind: ActivityKind;
  actor: string;
  brandId: BrandId | null;
  message: string;
  targetId: string | null;
  timestamp: string;
}

export type NotificationKind = "review" | "system" | "publish" | "mention";

export interface NotificationItem {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  timestamp: string;
  read: boolean;
  brandId: BrandId | null;
}

export type ServiceStatus = "operational" | "degraded" | "down";

export interface ServiceHealth {
  id: string;
  name: string;
  description: string;
  status: ServiceStatus;
  latencyMs: number;
  uptime: number;
}

/* -------------------------------------------------------------------------- */
/*  Analytics                                                                 */
/* -------------------------------------------------------------------------- */

export interface MetricCardData {
  id: string;
  label: string;
  value: number;
  previous: number;
  compact?: boolean;
  suffix?: string;
  hint: string;
  trend?: "up" | "down" | "flat";
}

export interface MetricPoint {
  label: string;
  value: number;
  previous: number;
}

export interface MetricSeries {
  id: string;
  label: string;
  unit: string;
  summary: string;
  points: MetricPoint[];
}

export interface BrandPerformance {
  brandId: BrandId;
  reach: number;
  engagementRate: number;
  followerGrowth: number;
  published: number;
}

/* -------------------------------------------------------------------------- */
/*  Shared UI types                                                           */
/* -------------------------------------------------------------------------- */

export type SortDirection = "asc" | "desc";

export interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
}

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
  description?: string;
}
