import { MOCK_NOW } from "@/data/time";
import type { DateRangeKey, Post, PostsFilters, PostsSort } from "@/types";

const DAY_MS = 86_400_000;

function startOfUtcDay(date: Date) {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/** Date windows are measured from the generation timestamp. */
export function matchesDateRange(
  generatedAt: string,
  range: DateRangeKey,
  filters: Pick<PostsFilters, "customFrom" | "customTo">,
  now: Date = MOCK_NOW,
) {
  if (range === "any") return true;

  const generated = startOfUtcDay(new Date(generatedAt));
  const today = startOfUtcDay(now);

  switch (range) {
    case "today":
      return generated === today;
    case "week":
      return generated >= today - 6 * DAY_MS && generated <= today;
    case "month":
      return generated >= today - 29 * DAY_MS && generated <= today;
    case "custom": {
      const from = filters.customFrom
        ? startOfUtcDay(new Date(filters.customFrom))
        : Number.NEGATIVE_INFINITY;
      const to = filters.customTo
        ? startOfUtcDay(new Date(filters.customTo))
        : Number.POSITIVE_INFINITY;
      return generated >= from && generated <= to;
    }
    default:
      return true;
  }
}

export function filterPosts(
  posts: Post[],
  filters: PostsFilters,
  now: Date = MOCK_NOW,
): Post[] {
  const needle = filters.search.trim().toLowerCase();

  return posts.filter((post) => {
    if (filters.brandId !== "all" && post.brandId !== filters.brandId) return false;
    if (filters.status !== "all" && post.status !== filters.status) return false;
    if (filters.category !== "all" && post.category !== filters.category) return false;
    if (filters.format !== "all" && post.format !== filters.format) return false;
    if (post.quality.score < filters.minQuality) return false;
    if (!matchesDateRange(post.generatedAt, filters.dateRange, filters, now)) {
      return false;
    }

    if (!needle) return true;

    return (
      post.title.toLowerCase().includes(needle) ||
      post.caption.toLowerCase().includes(needle) ||
      post.owner.toLowerCase().includes(needle) ||
      post.id.toLowerCase().includes(needle) ||
      post.category.toLowerCase().includes(needle) ||
      post.tags.some((tag) => tag.toLowerCase().includes(needle)) ||
      post.hashtags.some((tag) => tag.toLowerCase().includes(needle))
    );
  });
}

export function sortPosts(posts: Post[], sort: PostsSort): Post[] {
  const direction = sort.direction === "asc" ? 1 : -1;
  const byTime = (value: string | null) => (value ? Date.parse(value) : 0);

  const sorted = [...posts];

  sorted.sort((a, b) => {
    switch (sort.key) {
      case "quality":
        return (a.quality.score - b.quality.score) * direction;
      case "generated":
        return (byTime(a.generatedAt) - byTime(b.generatedAt)) * direction;
      case "scheduled":
        return (byTime(a.scheduledFor) - byTime(b.scheduledFor)) * direction;
      case "updated":
        return (byTime(a.updatedAt) - byTime(b.updatedAt)) * direction;
      case "status":
        return a.status.localeCompare(b.status) * direction;
      case "title":
        return a.title.localeCompare(b.title) * direction;
      default:
        return 0;
    }
  });

  return sorted;
}

export function paginate<T>(items: T[], page: number, pageSize: number) {
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(page, 1), pageCount);
  const start = (safePage - 1) * pageSize;

  return {
    rows: items.slice(start, start + pageSize),
    total,
    pageCount,
    page: safePage,
    rangeStart: total === 0 ? 0 : start + 1,
    rangeEnd: Math.min(start + pageSize, total),
  };
}

export function applyPostsQuery(
  posts: Post[],
  filters: PostsFilters,
  sort: PostsSort,
  page: number,
  pageSize: number,
  now: Date = MOCK_NOW,
) {
  const filtered = sortPosts(filterPosts(posts, filters, now), sort);
  return { ...paginate(filtered, page, pageSize), filtered };
}

const DATE_FILTERS: DateRangeKey[] = ["today", "week", "month", "custom"];

export function activeFilterCount(filters: PostsFilters) {
  return [
    filters.status !== "all",
    filters.brandId !== "all",
    filters.category !== "all",
    filters.format !== "all",
    DATE_FILTERS.includes(filters.dateRange),
    filters.minQuality > 0,
    filters.search.trim().length > 0,
  ].filter(Boolean).length;
}
