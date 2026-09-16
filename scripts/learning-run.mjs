#!/usr/bin/env node
/**
 * Weekly learning run — the GitHub Actions / cron entry point.
 *
 * Usage:
 *   node scripts/learning-run.mjs                        # localhost:3000
 *   SCHEDULER_URL=https://… node scripts/learning-run.mjs
 *   SCHEDULER_SECRET=… node scripts/learning-run.mjs      # sends the header
 *
 * Hits the same `POST /api/learning/run` the dashboard's "Run analysis now"
 * button calls, so a scheduled analysis and a manual one produce identical
 * weights — the analysis is deterministic over the same data.
 *
 * The response's report summary is printed, so a failed or empty run is visible
 * in the workflow log rather than silently succeeding.
 */

const base = (process.env.SCHEDULER_URL ?? "http://localhost:3000").replace(/\/$/, "");
const url = `${base}/api/learning/run`;
const secret = process.env.SCHEDULER_SECRET;

try {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(secret ? { "x-scheduler-secret": secret } : {}),
    },
    // The analysis reads the whole warehouse; it is CPU-bound, not network-bound,
    // so the timeout is generous compared with the scheduler tick.
    body: JSON.stringify({ trigger: "cron" }),
    signal: AbortSignal.timeout(55_000),
  });

  const text = await response.text();

  if (!response.ok) {
    console.error(`Learning run failed: HTTP ${response.status}\n${text}`);
    process.exit(1);
  }

  const payload = JSON.parse(text);
  const report = payload.report ?? {};

  console.log(`Learning run OK — weights updated: ${payload.weightsUpdated ?? 0}`);
  console.log(`Sample: ${report.sampleSize ?? 0} posts over ${report.windowDays ?? 0} days`);
  console.log(`Summary: ${report.summary ?? "(none)"}`);

  if ((report.topicWeights ?? []).length > 0) {
    for (const topic of report.topicWeights) {
      console.log(
        `  ${topic.multiplier}×  ${topic.label}  (${topic.posts} posts, ${(
          topic.avgEngagementRate * 100
        ).toFixed(2)}%)`,
      );
    }
  }
} catch (error) {
  console.error(
    `Learning run unreachable: ${error instanceof Error ? error.message : error}`,
  );
  process.exit(1);
}
