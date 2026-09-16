import {
  BadgeCheck,
  Brain,
  CheckCheck,
  CircleCheck,
  CircleDot,
  CircleSlash,
  Clock,
  MapPin,
  Send,
  Shapes,
  TriangleAlert,
  Undo2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import {
  BRAND_STATUS_LABELS,
  CONTENT_FORMAT_LABELS,
  CONTENT_STATUS_LABELS,
  QUALITY_THRESHOLDS,
} from "@/lib/constants";
import type {
  BrandStatus,
  ContentFormat,
  ContentStatus,
  PostCategory,
  QualityVerdict,
  ServiceStatus,
  SourceCredibility,
} from "@/types";

export type Tone =
  | "neutral"
  | "accent"
  | "accent-outline"
  | "success"
  | "success-outline"
  | "warning"
  | "danger"
  | "danger-outline";

export interface StatusMeta {
  label: string;
  tone: Tone;
  icon: LucideIcon;
}

/**
 * Seven lifecycle states mapped onto a monochrome-first scale: fills for the
 * states that need attention, outlines for the terminal ones so a rejected post
 * never reads as loudly as a failed publish.
 */
export const CONTENT_STATUS_META: Record<ContentStatus, StatusMeta> = {
  draft: {
    label: CONTENT_STATUS_LABELS.draft,
    tone: "neutral",
    icon: CircleDot,
  },
  pending_review: {
    label: CONTENT_STATUS_LABELS.pending_review,
    tone: "warning",
    icon: Clock,
  },
  approved: {
    label: CONTENT_STATUS_LABELS.approved,
    tone: "success",
    icon: CircleCheck,
  },
  scheduled: {
    label: CONTENT_STATUS_LABELS.scheduled,
    tone: "accent",
    icon: Send,
  },
  published: {
    label: CONTENT_STATUS_LABELS.published,
    tone: "success-outline",
    icon: CheckCheck,
  },
  failed: {
    label: CONTENT_STATUS_LABELS.failed,
    tone: "danger",
    icon: TriangleAlert,
  },
  rejected: {
    label: CONTENT_STATUS_LABELS.rejected,
    tone: "danger-outline",
    icon: Undo2,
  },
};

export const BRAND_STATUS_META: Record<BrandStatus, StatusMeta> = {
  active: { label: BRAND_STATUS_LABELS.active, tone: "success", icon: CircleCheck },
  paused: { label: BRAND_STATUS_LABELS.paused, tone: "neutral", icon: CircleSlash },
};

export const SERVICE_STATUS_META: Record<ServiceStatus, StatusMeta> = {
  operational: { label: "Operational", tone: "success", icon: CircleCheck },
  degraded: { label: "Degraded", tone: "warning", icon: CircleDot },
  down: { label: "Down", tone: "danger", icon: CircleCheck },
};

export const CATEGORY_META: Record<
  PostCategory,
  { label: PostCategory; tone: Tone; icon: LucideIcon; description: string }
> = {
  Geography: {
    label: "Geography",
    tone: "neutral",
    icon: MapPin,
    description: "Place, city systems and movement",
  },
  Psychology: {
    label: "Psychology",
    tone: "neutral",
    icon: Brain,
    description: "Behaviour, attention and decision-making",
  },
  Branding: {
    label: "Branding",
    tone: "neutral",
    icon: Shapes,
    description: "Identity, voice and category design",
  },
};

export const QUALITY_VERDICT_META: Record<
  QualityVerdict,
  { label: string; tone: Tone; icon: LucideIcon }
> = {
  excellent: { label: "Excellent", tone: "success", icon: BadgeCheck },
  strong: { label: "Strong", tone: "success-outline", icon: CircleCheck },
  review: { label: "Needs a look", tone: "warning", icon: Clock },
  weak: { label: "Weak", tone: "danger", icon: TriangleAlert },
};

export const CREDIBILITY_META: Record<
  SourceCredibility,
  { label: string; tone: Tone }
> = {
  high: { label: "High trust", tone: "success-outline" },
  medium: { label: "Medium trust", tone: "neutral" },
  low: { label: "Low trust", tone: "danger-outline" },
};

export function qualityVerdict(score: number): QualityVerdict {
  if (score >= QUALITY_THRESHOLDS.excellent) return "excellent";
  if (score >= QUALITY_THRESHOLDS.strong) return "strong";
  if (score >= QUALITY_THRESHOLDS.review) return "review";
  return "weak";
}

export const FORMAT_LABELS = CONTENT_FORMAT_LABELS;

export const DOT_CLASSES: Record<Tone, string> = {
  neutral: "bg-ink-3",
  accent: "bg-white",
  "accent-outline": "bg-ink",
  success: "bg-success",
  "success-outline": "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  "danger-outline": "bg-danger",
};

export const FORMAT_ORDER: ContentFormat[] = [
  "reel",
  "carousel",
  "static",
  "story",
];

/** Tab order in the queue: what needs a decision first, then the pipeline. */
export const STATUS_ORDER: ContentStatus[] = [
  "pending_review",
  "draft",
  "approved",
  "scheduled",
  "published",
  "failed",
  "rejected",
];

/** Statuses a reviewer can act on directly from the queue. */
export const REVIEWABLE_STATUSES: ContentStatus[] = ["draft", "pending_review"];

export function isReviewable(status: ContentStatus) {
  return REVIEWABLE_STATUSES.includes(status);
}
