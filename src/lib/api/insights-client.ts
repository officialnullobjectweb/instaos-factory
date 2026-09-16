import type {
  BrandInsightSummary,
  BrandId,
  Granularity,
  InsightPoint,
  InsightTotals,
  LearningReport,
  LearningState,
  PostAnalytics,
  PostInsight,
} from "@/types";

/**
 * Client transport for analytics and the learning engine.
 *
 * Same contract as the posts, schedule and design clients: plain functions,
 * explicit errors carrying the server's explanation, no hidden retries.
 */

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });

  const payload = (await response.json().catch(() => null)) as
    | (T & { error?: string })
    | null;

  if (!response.ok || payload === null) {
    throw new Error(payload?.error ?? `Request failed (${response.status})`);
  }
  return payload;
}

/* -------------------------------- dashboard ------------------------------- */

export interface InsightsDashboard {
  generatedAt: string;
  range: { from: string | null; to: string | null };
  window: { days: number; granularity: Granularity; periods: number };
  totals: InsightTotals;
  previousTotals: InsightTotals;
  series: InsightPoint[];
  byBrand: BrandInsightSummary[];
  seriesByBrand: Array<{ brandId: BrandId; points: InsightPoint[] }>;
  topPosts: PostInsight[];
  empty: boolean;
}

export async function fetchInsights(query: {
  days: number;
  granularity: Granularity;
}): Promise<InsightsDashboard> {
  const params = new URLSearchParams({
    days: String(query.days),
    granularity: query.granularity,
  });
  return request<InsightsDashboard>(`/api/insights?${params.toString()}`);
}

export async function fetchPostAnalytics(postId: string): Promise<PostAnalytics> {
  const { analytics } = await request<{ analytics: PostAnalytics }>(
    `/api/insights/${encodeURIComponent(postId)}`,
  );
  return analytics;
}

/* -------------------------------- learning -------------------------------- */

export interface LearningPayload {
  state: LearningState;
  empty: boolean;
}

export async function fetchLearning(): Promise<LearningPayload> {
  return request<LearningPayload>("/api/learning");
}

export interface LearningRunResult {
  report: LearningReport;
  updatedAt: string | null;
  weightsUpdated: number;
}

/** Runs one analysis. Used by the manual trigger; the Sunday cron hits the same route. */
export async function runLearningAnalysis(
  windowDays?: number,
): Promise<LearningRunResult> {
  return request<LearningRunResult>("/api/learning/run", {
    method: "POST",
    body: JSON.stringify({ trigger: "manual", windowDays }),
  });
}
