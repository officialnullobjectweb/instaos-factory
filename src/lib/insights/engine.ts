import type {
  BrandId,
  BrandInsightSummary,
  DailyInsight,
  Granularity,
  InsightPoint,
  InsightTotals,
  PostAnalytics,
  PostInsight,
  SlideRanking,
} from "@/types";

/**
 * The analytics engine.
 *
 * Every figure on the analytics surface is derived here from the same two raw
 * tables — the daily rollup and the per-post records — and nothing is stored
 * pre-computed. That matters more than it sounds: the previous version of this
 * page showed a hard-coded reach series next to a per-post ranking that read
 * from a different source, so the two could disagree and nobody would notice.
 */

/* --------------------------------- helpers -------------------------------- */

function round(value: number, places = 3) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

/** ISO date (UTC) key for a timestamp. */
export function dayKey(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toISOString().slice(0, 10);
}

/** Monday of the week containing `date`, in UTC. */
function weekStart(date: Date): Date {
  const monday = new Date(date);
  const weekday = monday.getUTCDay();
  // Sunday (0) belongs to the week that started six days earlier.
  const offset = weekday === 0 ? 6 : weekday - 1;
  monday.setUTCDate(monday.getUTCDate() - offset);
  monday.setUTCHours(0, 0, 0, 0);
  return monday;
}

function monthStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function weekdayLabel(dayOfWeek: number): string {
  return WEEKDAYS[((dayOfWeek % 7) + 7) % 7];
}

/** "14:00" in UTC — every stored timestamp is UTC, so labels must be too. */
export function hourLabel(hourUtc: number): string {
  return `${String(hourUtc).padStart(2, "0")}:00`;
}

/* --------------------------------- totals --------------------------------- */

export function emptyTotals(): InsightTotals {
  return {
    reach: 0,
    impressions: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    saves: 0,
    follows: 0,
    profileVisits: 0,
    engagementRate: 0,
    saveRate: 0,
    shareRate: 0,
    publishedPosts: 0,
  };
}

function withRates(totals: InsightTotals): InsightTotals {
  const interactions =
    totals.likes + totals.comments + totals.shares + totals.saves;
  return {
    ...totals,
    engagementRate: totals.reach > 0 ? round(interactions / totals.reach, 4) : 0,
    saveRate: totals.reach > 0 ? round(totals.saves / totals.reach, 4) : 0,
    shareRate: totals.reach > 0 ? round(totals.shares / totals.reach, 4) : 0,
  };
}

export function sumDays(days: DailyInsight[]): InsightTotals {
  const totals = days.reduce<InsightTotals>((accumulator, day) => {
    accumulator.reach += day.reach;
    accumulator.impressions += day.impressions;
    accumulator.likes += day.likes;
    accumulator.comments += day.comments;
    accumulator.shares += day.shares;
    accumulator.saves += day.saves;
    accumulator.follows += day.follows;
    accumulator.profileVisits += day.profileVisits;
    return accumulator;
  }, emptyTotals());
  return withRates(totals);
}

/** The trailing `days` window ending on the dataset's last day. */
export function windowDays(
  days: DailyInsight[],
  length: number,
  offset = 0,
): DailyInsight[] {
  if (days.length === 0) return [];
  const dates = [...new Set(days.map((day) => day.date))].sort();
  const end = dates.length - offset;
  const start = Math.max(0, end - length);
  const keep = new Set(dates.slice(start, end));
  return days.filter((day) => keep.has(day.date));
}

/* --------------------------------- series --------------------------------- */

interface Bucket {
  key: string;
  startsAt: string;
  label: string;
  totals: InsightTotals;
}

function bucketOf(date: Date, granularity: Granularity): { key: string; startsAt: Date; label: string } {
  if (granularity === "monthly") {
    const start = monthStart(date);
    return {
      key: dayKey(start),
      startsAt: start,
      label: `${MONTHS[start.getUTCMonth()]}`,
    };
  }
  if (granularity === "weekly") {
    const start = weekStart(date);
    return {
      key: dayKey(start),
      startsAt: start,
      label: `${MONTHS[start.getUTCMonth()]} ${start.getUTCDate()}`,
    };
  }
  return {
    key: dayKey(date),
    startsAt: new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())),
    label: `${WEEKDAYS[date.getUTCDay()]} ${date.getUTCDate()}`,
  };
}

function bucketise(days: DailyInsight[], granularity: Granularity): Bucket[] {
  const buckets = new Map<string, Bucket>();

  for (const day of days) {
    const date = new Date(`${day.date}T00:00:00.000Z`);
    const { key, startsAt, label } = bucketOf(date, granularity);
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { key, startsAt: startsAt.toISOString(), label, totals: emptyTotals() };
      buckets.set(key, bucket);
    }
    bucket.totals.reach += day.reach;
    bucket.totals.impressions += day.impressions;
    bucket.totals.likes += day.likes;
    bucket.totals.comments += day.comments;
    bucket.totals.shares += day.shares;
    bucket.totals.saves += day.saves;
    bucket.totals.follows += day.follows;
    bucket.totals.profileVisits += day.profileVisits;
  }

  return [...buckets.values()]
    .map((bucket) => ({ ...bucket, totals: withRates(bucket.totals) }))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

/**
 * Chart series with a previous-period comparison.
 *
 * The comparison shifts by exactly the size of the visible window, so "daily"
 * over 14 points compares against the 14 days before it — not against the
 * preceding point, which is the mistake that makes a trend badge lie.
 */
export function buildSeries(
  days: DailyInsight[],
  granularity: Granularity,
  periods: number,
): InsightPoint[] {
  const all = bucketise(days, granularity);
  if (all.length === 0) return [];

  const visible = all.slice(-periods);
  const shift = visible.length;

  return visible.map((bucket, index) => {
    const previousBucket = all[index + (all.length - visible.length) - shift];
    return {
      label: bucket.label,
      startsAt: bucket.startsAt,
      reach: bucket.totals.reach,
      likes: bucket.totals.likes,
      comments: bucket.totals.comments,
      shares: bucket.totals.shares,
      saves: bucket.totals.saves,
      follows: bucket.totals.follows,
      engagement:
        bucket.totals.likes +
        bucket.totals.comments +
        bucket.totals.shares +
        bucket.totals.saves,
      engagementRate: bucket.totals.engagementRate,
      previousReach: previousBucket?.totals.reach ?? 0,
      previousLikes: previousBucket?.totals.likes ?? 0,
      previousComments: previousBucket?.totals.comments ?? 0,
      previousShares: previousBucket?.totals.shares ?? 0,
      previousSaves: previousBucket?.totals.saves ?? 0,
      previousFollows: previousBucket?.totals.follows ?? 0,
      previousEngagement: previousBucket
        ? previousBucket.totals.likes +
          previousBucket.totals.comments +
          previousBucket.totals.shares +
          previousBucket.totals.saves
        : 0,
      previousEngagementRate: previousBucket?.totals.engagementRate ?? 0,
    };
  });
}

/* ---------------------------- brand comparison ---------------------------- */

export function brandSummaries(
  days: DailyInsight[],
  posts: PostInsight[],
): BrandInsightSummary[] {
  const brandIds = [...new Set(days.map((day) => day.brandId))];

  return brandIds
    .map((brandId) => {
      const brandDays = days.filter((day) => day.brandId === brandId);
      const totals = sumDays(brandDays);

      const ordered = [...brandDays].sort((a, b) => a.date.localeCompare(b.date));
      const startFollowers = ordered[0]?.followersEnd ?? 0;
      const endFollowers = ordered[ordered.length - 1]?.followersEnd ?? 0;
      const followerGrowth = endFollowers - startFollowers;

      const brandPosts = posts.filter((post) => post.brandId === brandId);

      return {
        ...totals,
        brandId,
        publishedPosts: brandPosts.length,
        followerGrowth,
        followerGrowthRate:
          startFollowers > 0 ? round((followerGrowth / startFollowers) * 100, 2) : 0,
        reachPerPost:
          brandPosts.length > 0 ? Math.round(totals.reach / brandPosts.length) : 0,
      };
    })
    .sort((a, b) => b.reach - a.reach);
}

/** Grouped daily rollups, so each brand can be charted on its own. */
export function seriesByBrand(
  days: DailyInsight[],
  granularity: Granularity,
  periods: number,
): Array<{ brandId: BrandId; points: InsightPoint[] }> {
  const brandIds = [...new Set(days.map((day) => day.brandId))];
  return brandIds.map((brandId) => ({
    brandId,
    points: buildSeries(
      days.filter((day) => day.brandId === brandId),
      granularity,
      periods,
    ),
  }));
}

/* ------------------------------ post detail ------------------------------- */

function interactionsOf(insight: PostInsight) {
  return insight.likes + insight.comments + insight.shares + insight.saves;
}

export function postTotals(insight: PostInsight): InsightTotals {
  // Views are not reach — a slide seen twice is still one account — so the
  // per-post engagement rate stays anchored to the post's own reach.
  return withRates({
    ...emptyTotals(),
    reach: insight.reach,
    impressions: insight.impressions,
    likes: insight.likes,
    comments: insight.comments,
    shares: insight.shares,
    saves: insight.saves,
    follows: insight.follows,
    profileVisits: insight.profileVisits,
    publishedPosts: 1,
  });
}

export function analysePost(
  insight: PostInsight,
  peers: PostInsight[],
): PostAnalytics {
  const totals = postTotals(insight);
  const slides = insight.slides;

  /* The first slide sets the audience; every later slide is measured against
     it, because a slide can only be skipped by someone who arrived. */
  const firstViews = slides[0]?.views ?? 0;
  const lastViews = slides[slides.length - 1]?.views ?? 0;
  const completionRate =
    slides.length > 1 && firstViews > 0 ? round(lastViews / firstViews, 4) : null;

  const ranking: SlideRanking[] = slides.map((slide, index) => {
    const previous = slides[index - 1];
    // Drop-off is relative to the previous slide, not to the first: that is
    // what shows *which* slide lost the reader.
    const dropOff =
      index === 0 || !previous || previous.views === 0
        ? 0
        : round(Math.max(0, (previous.views - slide.views) / previous.views), 4);

    const engagement = slide.likes + slide.comments + slide.shares + slide.saves;
    return {
      index: slide.index,
      views: slide.views,
      saves: slide.saves,
      shares: slide.shares,
      comments: slide.comments,
      engagementPerMille:
        slide.views > 0 ? round((engagement / slide.views) * 1000, 2) : 0,
      dropOff,
    };
  });

  const byEngagement = [...ranking].sort(
    (a, b) => b.engagementPerMille - a.engagementPerMille,
  );

  const sameCategory = peers
    .filter((peer) => peer.category === insight.category)
    .map((peer) => peer.reach)
    .sort((a, b) => a - b);
  const below = sameCategory.filter((value) => value < insight.reach).length;
  const categoryPercentile =
    sameCategory.length > 0 ? round((below / sameCategory.length) * 100, 1) : 0;

  return {
    insight,
    totals,
    completionRate,
    saveRate: totals.saveRate,
    shareRate: totals.shareRate,
    commentRate: insight.reach > 0 ? round(insight.comments / insight.reach, 4) : 0,
    ranking,
    bestSlide: ranking.length > 0 ? byEngagement[0] : null,
    worstSlide: ranking.length > 1 ? byEngagement[byEngagement.length - 1] : null,
    categoryPercentile,
  };
}

/**
 * Composite score used by every ranking on this page.
 *
 * Reach alone rewards luck and a single engagement rate rewards tiny posts, so
 * the score combines rates (what the audience did) with a log-scaled reach
 * (how many had the chance) — logged because reach spans two orders of
 * magnitude and a linear term would make it the only factor that mattered.
 */
export function compositeScore(insight: PostInsight): number {
  const totals = postTotals(insight);
  const reachFactor = Math.log10(Math.max(10, insight.reach)) / 5;
  return round(
    (totals.engagementRate * 100) * 0.45 +
      totals.saveRate * 100 * 0.3 +
      totals.shareRate * 100 * 0.15 +
      reachFactor * 10 * 0.1,
    4,
  );
}

export { interactionsOf, round };
