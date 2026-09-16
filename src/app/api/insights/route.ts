import { NextResponse } from "next/server";

import {
  brandSummaries,
  buildSeries,
  compositeScore,
  seriesByBrand,
  sumDays,
  windowDays,
} from "@/lib/insights/engine";
import {
  getDataset,
  listPostInsights,
} from "@/lib/repositories/insights-repository";
import type { Granularity } from "@/types";

export const dynamic = "force-dynamic";

const GRANULARITIES: Granularity[] = ["daily", "weekly", "monthly"];
const WINDOWS = [7, 28, 84];

/** Buckets shown for each granularity, given the selected window. */
function periodsFor(granularity: Granularity, days: number): number {
  if (granularity === "daily") return Math.min(days, 14);
  if (granularity === "weekly") return Math.max(4, Math.round(days / 7));
  return 6;
}

/**
 * GET /api/insights — the whole analytics dashboard in one response.
 *
 * One request rather than five because every panel is derived from the same two
 * tables; splitting it would let the metric cards and the charts disagree while
 * the second request was in flight.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const requestedGranularity = url.searchParams.get("granularity") as
    | Granularity
    | null;
  const granularity =
    requestedGranularity && GRANULARITIES.includes(requestedGranularity)
      ? requestedGranularity
      : "daily";

  const requestedDays = Number(url.searchParams.get("days") ?? 7);
  const days = WINDOWS.includes(requestedDays) ? requestedDays : 7;

  const dataset = await getDataset();
  if (dataset.days.length === 0) {
    return NextResponse.json({
      generatedAt: dataset.generatedAt,
      range: { from: null, to: null },
      window: { days, granularity, periods: periodsFor(granularity, days) },
      totals: sumDays([]),
      previousTotals: sumDays([]),
      series: [],
      byBrand: [],
      seriesByBrand: [],
      topPosts: [],
      empty: true,
    });
  }

  const [currentDays, previousDays] = [
    windowDays(dataset.days, days),
    windowDays(dataset.days, days, days),
  ];

  const posts = await listPostInsights();
  // Rank on posts published inside the window so the list matches the numbers
  // above it, rather than surfacing an old post that happens to still travel.
  // The window is anchored to the warehouse's last day, not to the wall clock:
  // the daily rollup stops at that date, and measuring posts against a moving
  // "now" would empty this list while the charts above it still showed data.
  const reference = new Date(`${dataset.to}T23:59:59.999Z`).getTime();
  const inWindow = (post: (typeof posts)[number], offsetPeriods: number) => {
    const age = reference - new Date(post.publishedAt).getTime();
    const upper = days * 86_400_000 * (offsetPeriods + 1);
    const lower = days * 86_400_000 * offsetPeriods;
    return age <= upper && age > lower;
  };
  const windowPosts = posts.filter((post) => inWindow(post, 0));
  const previousPosts = posts.filter((post) => inWindow(post, 1));

  const totals = sumDays(currentDays);
  const previousTotals = sumDays(previousDays);

  return NextResponse.json({
    generatedAt: dataset.generatedAt,
    range: { from: dataset.from, to: dataset.to },
    window: { days, granularity, periods: periodsFor(granularity, days) },
    // Impressions come from the same rollup as reach now, so the two cards
    // describe one scope rather than two.
    totals: {
      ...totals,
      publishedPosts: windowPosts.length,
    },
    previousTotals: {
      ...previousTotals,
      publishedPosts: previousPosts.length,
    },
    series: buildSeries(dataset.days, granularity, periodsFor(granularity, days)),
    byBrand: brandSummaries(currentDays, windowPosts),
    seriesByBrand: seriesByBrand(dataset.days, granularity, periodsFor(granularity, days)),
    topPosts: [...windowPosts]
      .sort((a, b) => compositeScore(b) - compositeScore(a))
      .slice(0, 8),
    empty: false,
  });
}
