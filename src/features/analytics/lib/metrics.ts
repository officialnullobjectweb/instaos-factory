import {
  Bookmark,
  Heart,
  MessageCircle,
  Repeat2,
  Send,
  TrendingUp,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { formatCompact, formatNumber } from "@/lib/format";
import type { InsightPoint, InsightTotals } from "@/types";

/**
 * The metric catalogue.
 *
 * The dashboard's cards and the charts' metric picker read from this one list,
 * so a metric can never appear in a chart and be missing from the row above it,
 * and both format it the same way.
 */

export type InsightMetricId =
  | "reach"
  | "likes"
  | "comments"
  | "shares"
  | "saves"
  | "engagement"
  | "follows";

export interface InsightMetricDef {
  id: InsightMetricId;
  label: string;
  hint: string;
  icon: LucideIcon;
  /** True when the value is a proportion rather than a count. */
  percent: boolean;
  /** Reads from the aggregate totals. */
  fromTotals: (totals: InsightTotals) => number;
  /** Reads from one chart bucket. */
  fromPoint: (point: InsightPoint) => number;
  /** Reads the same metric from the previous period's bucket. */
  previousFromPoint: (point: InsightPoint) => number;
  /** Renders a value the same way in a card, a bar title and a table. */
  format: (value: number) => string;
}

const asPercent = (value: number) => value * 100;

/** Interactions as a share of reach, expressed in percent. */
function rate(numerator: number, reach: number) {
  return reach > 0 ? (numerator / reach) * 100 : 0;
}

export const INSIGHT_METRICS: InsightMetricDef[] = [
  {
    id: "reach",
    label: "Reach",
    hint: "Accounts reached in the window",
    icon: TrendingUp,
    percent: false,
    fromTotals: (totals) => totals.reach,
    fromPoint: (point) => point.reach,
    previousFromPoint: (point) => point.previousReach,
    format: formatCompact,
  },
  {
    id: "likes",
    label: "Likes",
    hint: "Total likes across published posts",
    icon: Heart,
    percent: false,
    fromTotals: (totals) => totals.likes,
    fromPoint: (point) => point.likes,
    previousFromPoint: (point) => point.previousLikes,
    format: formatCompact,
  },
  {
    id: "comments",
    label: "Comments",
    hint: "Replies and comment threads",
    icon: MessageCircle,
    percent: false,
    fromTotals: (totals) => totals.comments,
    fromPoint: (point) => point.comments,
    previousFromPoint: (point) => point.previousComments,
    format: formatCompact,
  },
  {
    id: "shares",
    label: "Shares",
    hint: "Sends and reposts to stories",
    icon: Repeat2,
    percent: false,
    fromTotals: (totals) => totals.shares,
    fromPoint: (point) => point.shares,
    previousFromPoint: (point) => point.previousShares,
    format: formatCompact,
  },
  {
    id: "saves",
    label: "Saves",
    hint: "Bookmarks — the strongest intent signal",
    icon: Bookmark,
    percent: false,
    fromTotals: (totals) => totals.saves,
    fromPoint: (point) => point.saves,
    previousFromPoint: (point) => point.previousSaves,
    format: formatCompact,
  },
  {
    id: "engagement",
    label: "Engagement rate",
    hint: "Likes + comments + shares + saves ÷ reach",
    icon: Send,
    percent: true,
    fromTotals: (totals) => asPercent(totals.engagementRate),
    fromPoint: (point) => asPercent(point.engagementRate),
    previousFromPoint: (point) => asPercent(point.previousEngagementRate),
    // Two decimals on a rate: the difference between 8.2% and 8.6% is the
    // difference between two topics, which is the whole point of this page.
    format: (value) => `${value.toFixed(2)}%`,
  },
  {
    id: "follows",
    label: "Follower growth",
    hint: "Net new followers attributed to content",
    icon: Users,
    percent: false,
    fromTotals: (totals) => totals.follows,
    fromPoint: (point) => point.follows,
    previousFromPoint: (point) => point.previousFollows,
    format: (value) => `${value >= 0 ? "+" : "−"}${formatNumber(Math.abs(value))}`,
  },
];

export const METRIC_BY_ID = Object.fromEntries(
  INSIGHT_METRICS.map((metric) => [metric.id, metric]),
) as Record<InsightMetricId, InsightMetricDef>;

export { rate };
