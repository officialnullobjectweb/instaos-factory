export const APP_NAME = "Instagram Factory OS";
export const APP_SHORT_NAME = "Factory OS";
export const APP_DESCRIPTION =
  "The internal operating system for reviewing, scheduling and publishing three Instagram brands from one dashboard.";

export const SIDEBAR = {
  width: 272,
  railWidth: 76,
  /** Persisted behaviour: pinned, hover-to-expand or icons only. */
  storageKey: "factory-os.sidebar-mode",
  /** Persisted collapse toggle, used by `pinned` mode only. */
  collapsedStorageKey: "factory-os.sidebar-collapsed",
} as const;

export type SidebarMode = "pinned" | "hover" | "rail";

export const SIDEBAR_MODE_ORDER: SidebarMode[] = ["pinned", "hover", "rail"];

export const SIDEBAR_MODE_META: Record<
  SidebarMode,
  { label: string; description: string }
> = {
  pinned: {
    label: "Always open",
    description:
      "Names and icons stay visible. Collapse on demand with ⌘B.",
  },
  hover: {
    label: "Open on hover",
    description:
      "Starts as icons only and expands over the page while your pointer is on it.",
  },
  rail: {
    label: "Icons only",
    description:
      "Stays collapsed. Hover an icon to read its name in a tooltip.",
  },
};

export const PAGINATION = {
  defaultPageSize: 12,
  pageSizeOptions: [12, 24, 48],
} as const;

export const CONTENT_STATUS_LABELS = {
  draft: "Draft",
  pending_review: "Pending review",
  approved: "Approved",
  scheduled: "Scheduled",
  published: "Published",
  failed: "Failed",
  rejected: "Rejected",
} as const;

export const CONTENT_FORMAT_LABELS = {
  reel: "Reel",
  carousel: "Carousel",
  static: "Static post",
  story: "Story",
} as const;

export const BRAND_STATUS_LABELS = {
  active: "Active",
  paused: "Paused",
} as const;

/** Quality verdict thresholds, shared by the report and the table. */
export const QUALITY_THRESHOLDS = {
  excellent: 90,
  strong: 80,
  review: 70,
} as const;

export const QUALITY_FILTER_OPTIONS = [0, 70, 80, 90] as const;

export const DATE_RANGE_LABELS = {
  any: "Any date",
  today: "Generated today",
  week: "Last 7 days",
  month: "Last 30 days",
  custom: "Custom range",
} as const;

export const AUTOSAVE_DELAY_MS = 700;

/** Simulated generator latency budget, surfaced in the generation logs. */
export const GENERATION_MODEL = "factory-engine-v4.2";

/**
 * Fired on `window` whenever a generation job settles, so panels that show AI
 * state (the dashboard log, the provider list) can refresh without polling.
 */
export const AI_ACTIVITY_EVENT = "factory-os:ai-activity";

export const AUTOMATION_PIPELINE = [
  { id: "ideation", label: "Ideation", detail: "Trend + brief intake" },
  { id: "generation", label: "Generation", detail: "Caption & asset drafts" },
  { id: "review", label: "Human review", detail: "Approval queue" },
  { id: "scheduling", label: "Scheduling", detail: "Optimal slot picking" },
  { id: "publishing", label: "Publishing", detail: "Instagram Graph API" },
] as const;
