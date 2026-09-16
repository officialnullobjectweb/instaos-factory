import type { BrandId, ContentFormat, PostCategory } from "@/types";

/**
 * Insights and the learning engine.
 *
 * One dataset feeds everything on this surface: the dashboard totals, the daily
 * /weekly/monthly charts, the brand comparison, post detail and the weekly
 * analysis. Deriving all of them from the same records is what stops the page
 * from contradicting itself — the previous version had hard-coded series next
 * to a per-post ranking that read from a completely different source.
 */

/** Which hook shape a post opened with. Assigned at compose time. */
export type HookType =
  | "number"
  | "contrarian"
  | "question"
  | "story"
  | "list"
  | "warning";

export type TopicId = string;

export interface SlideInsight {
  index: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  /** Average seconds on the slide, for carousel drop-off reading. */
  avgSeconds: number;
}

/** Raw per-post performance, exactly as the Insights sync would report it. */
export interface PostInsight {
  postId: string;
  /**
   * Set only when this post is still in the working queue. The analytics
   * warehouse keeps every post ever published, the queue keeps the ones in
   * flight — so this is the explicit link between the two, and its absence is
   * meaningful rather than a broken reference.
   */
  queuePostId?: string;
  title: string;
  brandId: BrandId;
  category: PostCategory;
  format: ContentFormat;
  topicId: TopicId;
  topicLabel: string;
  hookType: HookType;
  /** ISO — when it went live. */
  publishedAt: string;
  /** 0 = Sunday, matching the posting-window convention elsewhere. */
  dayOfWeek: number;
  hourUtc: number;
  reach: number;
  impressions: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  follows: number;
  profileVisits: number;
  /** Per-slide figures; empty for single-image posts. */
  slides: SlideInsight[];
  /** Where the numbers came from, so a manual entry is never mistaken for a sync. */
  source: "sync" | "manual";
}

/** One day of account-level rollup, per brand. */
export interface DailyInsight {
  /** YYYY-MM-DD in UTC. */
  date: string;
  brandId: BrandId;
  reach: number;
  /**
   * Total views, always ≥ `reach`.
   *
   * Carried on the rollup rather than summed from the window's posts on read,
   * because the two would then describe different scopes: reach includes the
   * evergreen traffic from older posts and the profile, and impressions summed
   * from this week's posts alone would sit next to it as a smaller number,
   * implying a contradiction that is really just two different measurements.
   */
  impressions: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  follows: number;
  profileVisits: number;
  followersEnd: number;
}

/** The stored insights dataset. */
export interface InsightsDataset {
  generatedAt: string;
  /** First and last day covered by `days`. */
  from: string;
  to: string;
  days: DailyInsight[];
  posts: PostInsight[];
}

/* -------------------------------------------------------------------------- */
/*  Derived views                                                             */
/* -------------------------------------------------------------------------- */

export type Granularity = "daily" | "weekly" | "monthly";

/**
 * A single chart point.
 *
 * Every metric carries its own previous-period value rather than one shared
 * `previous`, because the metrics are not interchangeable — reach is a count
 * that sums, engagement rate is a ratio that must not.
 */
export interface InsightPoint {
  label: string;
  /** ISO date the bucket starts on. */
  startsAt: string;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  follows: number;
  engagement: number;
  engagementRate: number;
  previousReach: number;
  previousLikes: number;
  previousComments: number;
  previousShares: number;
  previousSaves: number;
  previousFollows: number;
  previousEngagement: number;
  previousEngagementRate: number;
}

export interface InsightTotals {
  reach: number;
  impressions: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  follows: number;
  profileVisits: number;
  /** (likes + comments + shares + saves) / reach. */
  engagementRate: number;
  /** Share of the window's reach that came from saves. */
  saveRate: number;
  /** Share of the window's reach that came from shares. */
  shareRate: number;
  publishedPosts: number;
}

export interface BrandInsightSummary extends InsightTotals {
  brandId: BrandId;
  /** Net followers gained inside the window. */
  followerGrowth: number;
  followerGrowthRate: number;
  /** Average reach per published post — the fair way to compare brands. */
  reachPerPost: number;
}

export interface SlideRanking {
  index: number;
  views: number;
  saves: number;
  shares: number;
  comments: number;
  /** Engagement per 1,000 views, so long and short slides compare fairly. */
  engagementPerMille: number;
  dropOff: number;
}

/** Post detail: everything the per-post analytics view needs. */
export interface PostAnalytics {
  insight: PostInsight;
  totals: InsightTotals;
  /** Last slide views ÷ first slide views. Null for single-image posts. */
  completionRate: number | null;
  saveRate: number;
  shareRate: number;
  commentRate: number;
  /** Slides ranked best → worst by engagement per mille. */
  ranking: SlideRanking[];
  bestSlide: SlideRanking | null;
  worstSlide: SlideRanking | null;
  /** Percentile against every other post in the same category. */
  categoryPercentile: number;
}

/* -------------------------------------------------------------------------- */
/*  Learning engine                                                           */
/* -------------------------------------------------------------------------- */

/** A topic's current standing, and the multiplier generation should apply. */
export interface TopicWeight {
  topicId: TopicId;
  label: string;
  category: PostCategory;
  posts: number;
  avgEngagementRate: number;
  avgReach: number;
  avgSaveRate: number;
  /** 0–1 share of total weight. */
  weight: number;
  /** 0.5–1.6 multiplier handed to the generation engine. */
  multiplier: number;
  trend: "rising" | "steady" | "falling";
}

export interface HookPerformance {
  hookType: HookType;
  posts: number;
  avgEngagementRate: number;
  avgReach: number;
  /** 0–1 share of total weight. */
  weight: number;
}

export interface TimePerformance {
  dayOfWeek: number;
  hourUtc: number;
  posts: number;
  avgEngagementRate: number;
  avgReach: number;
  /**
   * Mean reach adjusted by the engagement that reach produced.
   *
   * Not the composite used to rank content: `compositeScore` is ~500× more
   * sensitive to a relative change in engagement rate than to one in reach, so
   * importing it here let a 0.02-point engagement difference between two
   * 24-post windows outrank a 10% reach difference.
   */
  score: number;
}

export type RecommendationKind =
  | "best-hook"
  | "best-topic"
  | "best-time"
  | "worst-topic"
  | "next-week"
  | "format"
  | "slide";

export interface LearningRecommendation {
  id: string;
  kind: RecommendationKind;
  title: string;
  detail: string;
  /** The numbers behind the claim, one line, so it can be checked. */
  evidence: string;
  /** 0–1. Low confidence is stated rather than hidden. */
  confidence: number;
  /** Machine-readable payload for the actions a card can offer. */
  action?: {
    label: string;
    topicId?: TopicId;
    hookType?: HookType;
    hourUtc?: number;
    dayOfWeek?: number;
  };
}

/** One scheduled topic for next week. */
export interface PlannedPost {
  dayOfWeek: number;
  hourUtc: number;
  topicId: TopicId;
  topicLabel: string;
  hookType: HookType;
  reason: string;
}

export interface LearningReport {
  id: string;
  generatedAt: string;
  /** ISO date of the Monday the report covers. */
  weekOf: string;
  trigger: "cron" | "manual";
  /** Posts the analysis was able to read. */
  sampleSize: number;
  /** Posts in the analysis window. */
  windowDays: number;
  topPosts: Array<{
    postId: string;
    title: string;
    brandId: BrandId;
    reach: number;
    engagementRate: number;
    saveRate: number;
  }>;
  recommendations: LearningRecommendation[];
  topicWeights: TopicWeight[];
  hooks: HookPerformance[];
  times: TimePerformance[];
  plan: PlannedPost[];
  /** One-line summary of what changed since the previous report. */
  summary: string;
}

export interface LearningState {
  updatedAt: string | null;
  /** The report the UI shows. */
  latest: LearningReport | null;
  /** Kept so a weight change can be explained after the fact. */
  history: LearningReport[];
  /** Current multipliers, read by the generation engine on every run. */
  topicWeights: TopicWeight[];
}
