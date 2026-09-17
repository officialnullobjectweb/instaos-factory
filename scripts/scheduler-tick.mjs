#!/usr/bin/env node
/**
 * Scheduler tick runner — the GitHub Actions / cron entry point.
 *
 * Usage:
 *   node scripts/scheduler-tick.mjs                       # .env, else localhost:3780
 *   SCHEDULER_URL=https://… node scripts/scheduler-tick.mjs
 *   SCHEDULER_SECRET=… node scripts/scheduler-tick.mjs    # sends the header
 *
 * `.env` supplies both values when the environment does not (the app refuses an
 * unauthenticated tick once it runs in production mode), and CI-provided values
 * always win. The local default port matches what the app actually runs on.
 *
 * The endpoint is the same `POST /api/schedule/process` the dashboard's
 * "Run scheduler now" button calls, so a CI tick and a manual tick can never
 * diverge.
 */

import { appUrl, loadEnv, secretHeaders } from "./load-env.mjs";

await loadEnv();

const url = `${appUrl()}/api/schedule/process`;

try {
  const response = await fetch(url, {
    method: "POST",
    headers: secretHeaders(),
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
