#!/usr/bin/env node
/**
 * Scheduler tick runner — the GitHub Actions / cron entry point.
 *
 * Usage:
 *   node scripts/scheduler-tick.mjs                       # localhost:3000
 *   SCHEDULER_URL=https://… node scripts/scheduler-tick.mjs
 *   SCHEDULER_SECRET=… node scripts/scheduler-tick.mjs    # sends the header
 *
 * The endpoint is the same `POST /api/schedule/process` the dashboard's
 * "Run scheduler now" button calls, so a CI tick and a manual tick can never
 * diverge.
 */

const url = `${(process.env.SCHEDULER_URL ?? "http://localhost:3000").replace(/\/$/, "")}/api/schedule/process`;
const secret = process.env.SCHEDULER_SECRET;

try {
  const response = await fetch(url, {
    method: "POST",
    headers: secret ? { "x-scheduler-secret": secret } : {},
    signal: AbortSignal.timeout(25_000),
  });

  const body = await response.text();

  if (!response.ok) {
    console.error(`Scheduler tick failed: HTTP ${response.status}\n${body}`);
    process.exit(1);
  }

  console.log(`Scheduler tick OK: ${body}`);
} catch (error) {
  console.error(
    `Scheduler tick unreachable: ${error instanceof Error ? error.message : error}`,
  );
  process.exit(1);
}
