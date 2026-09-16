import { document } from "@/lib/storage";
import type { DailyInsight, InsightsDataset, PostInsight } from "@/types";

/**
 * The analytics warehouse.
 *
 * `data/insights.json` is the committed fixture and, in a real deployment, the
 * target of the nightly Insights sync. It is read far more often than it is
 * written and is the largest document in the store, so it carries a longer
 * read cache than the rest: re-parsing a few hundred kilobytes of JSON on every
 * analytics request would be the most expensive thing on the page.
 *
 * Nothing here is derived — this module returns the raw rows and
 * `lib/insights/engine.ts` does the arithmetic, so a chart and a post detail
 * can never disagree about what a number means.
 */

const EMPTY: InsightsDataset = {
  generatedAt: new Date(0).toISOString(),
  from: "",
  to: "",
  days: [],
  posts: [],
};

/**
 * Normalises the dataset on read.
 *
 * A sync that fails halfway, or a fixture edited by hand, must not present as a
 * crash: each collection falls back to empty independently, and the UI renders
 * "no data yet" rather than an error page.
 */
function parseDataset(raw: unknown): InsightsDataset | null {
  if (typeof raw !== "object" || raw === null) return null;
  const parsed = raw as Partial<InsightsDataset>;

  return {
    generatedAt: parsed.generatedAt ?? EMPTY.generatedAt,
    from: parsed.from ?? "",
    to: parsed.to ?? "",
    days: Array.isArray(parsed.days) ? (parsed.days as DailyInsight[]) : [],
    posts: Array.isArray(parsed.posts) ? (parsed.posts as PostInsight[]) : [],
  };
}

/** Row-level guard: a day without a usable date cannot be charted. */
function isDailyInsight(raw: unknown): raw is DailyInsight {
  if (typeof raw !== "object" || raw === null) return false;
  const day = raw as Partial<DailyInsight>;
  return typeof day.date === "string" && typeof day.reach === "number";
}

const insights = () =>
  document<InsightsDataset>({
    key: "insights",
    ttlMs: 30_000,
    parse: parseDataset,
    fallback: () => EMPTY,
  });

export async function getDataset(): Promise<InsightsDataset> {
  const dataset = await insights().read();
  // Drop chart-breaking rows once, at the boundary, rather than defending in
  // every aggregation.
  return {
    ...dataset,
    days: dataset.days.filter(isDailyInsight),
  };
}

export async function listDaily(): Promise<DailyInsight[]> {
  return (await getDataset()).days;
}

/** Newest first — the order every ranking on the analytics page expects. */
export async function listPostInsights(): Promise<PostInsight[]> {
  const { posts } = await getDataset();
  return [...posts].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );
}

export async function getPostInsight(postId: string): Promise<PostInsight | null> {
  const { posts } = await getDataset();
  return (
    posts.find(
      (entry) => entry.postId === postId || entry.queuePostId === postId,
    ) ?? null
  );
}

/** Invalidates the read cache — used after a write or by the sync job. */
export function invalidateInsightsCache(): void {
  insights().invalidate();
}
