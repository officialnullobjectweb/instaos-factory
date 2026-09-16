import { NextResponse } from "next/server";

import { DEFAULT_WINDOW_DAYS, analysePerformance } from "@/lib/insights/learning";
import { listPostInsights } from "@/lib/repositories/insights-repository";
import {
  getLatestReport,
  recordReport,
} from "@/lib/repositories/learning-repository";
import { guardScheduler } from "@/lib/security/guards";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface RunBody {
  windowDays?: number;
  trigger?: "cron" | "manual";
}

/**
 * POST /api/learning/run — one weekly analysis.
 *
 * Called by the Sunday cron (`.github/workflows/learning.yml`, which sends the
 * scheduler secret) and by the button on the analytics page. The same shared
 * secret gate as the publishing tick, because this writes state the generation
 * engine acts on.
 *
 * The analysis is pure and deterministic, so re-running inside the same day
 * produces the same weights — a cron retry cannot drift the weights further.
 */
export async function POST(request: Request) {
  // Same gate as the publishing tick: this rewrites the weights the generation
  // engine follows, so an unauthenticated call changes what gets produced.
  const denied = guardScheduler(request);
  if (denied) return denied;

  let body: RunBody = {};
  try {
    // An empty body is valid — the cron sends the secret only.
    const text = await request.text();
    body = text ? (JSON.parse(text) as RunBody) : {};
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const windowDays =
    typeof body.windowDays === "number" && body.windowDays >= 7 && body.windowDays <= 180
      ? Math.round(body.windowDays)
      : DEFAULT_WINDOW_DAYS;

  const [posts, previous] = await Promise.all([
    listPostInsights(),
    getLatestReport(),
  ]);

  const report = analysePerformance({
    posts,
    windowDays,
    trigger: body.trigger === "cron" ? "cron" : "manual",
    previous,
  });

  const state = await recordReport(report);

  return NextResponse.json({
    report,
    updatedAt: state.updatedAt,
    weightsUpdated: report.topicWeights.length,
  });
}

/**
 * GET — the shape Vercel Cron actually sends. The Sunday cron lives in
 * `vercel.json` (it replaces the GitHub Actions clock on Vercel, where a
 * scheduler that does not need a running VM is the right default), so the
 * handler is an alias of POST: same guard, same analysis, same response.
 */
export async function GET(request: Request) {
  return POST(request);
}
