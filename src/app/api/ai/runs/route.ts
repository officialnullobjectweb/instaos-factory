import { NextResponse } from "next/server";

import { listJobs } from "@/lib/ai/jobs";
import { reconcileRuns, schedulerSnapshot } from "@/lib/ai/scheduler";
import { listRuns } from "@/lib/repositories/generation-runs-repository";

export const dynamic = "force-dynamic";

/**
 * Reconciliation is throttled to once a minute per process.
 *
 * It is cheap but not free — it reads the runs document and may write several
 * entries — and this route is polled every few seconds while a run is in flight.
 * A minute is comfortably faster than anyone notices an abandoned run and far
 * slower than the poll interval.
 */
const RECONCILE_INTERVAL_MS = 60_000;

const globalForReconcile = globalThis as unknown as { __factoryReconcileAt?: number };

async function reconcileThrottled(): Promise<void> {
  const now = Date.now();
  if (now - (globalForReconcile.__factoryReconcileAt ?? 0) < RECONCILE_INTERVAL_MS) {
    return;
  }
  globalForReconcile.__factoryReconcileAt = now;

  try {
    await reconcileRuns();
  } catch {
    // A store hiccup must not take down the panel that reports failures.
  }
}

/**
 * GET /api/ai/runs — what the generation engine has attempted.
 *
 * This is the half of the picture the queue could not previously show: a run that
 * failed produced no post, and the in-memory job registry forgets everything on
 * restart. The runs document is the durable record, so a reviewer can see which
 * step stopped a run and what the provider said.
 *
 * `jobs` is included alongside it because a run's persisted state is written when
 * a step settles, while the job carries the step currently in flight — together
 * they cover both "what happened" and "what is happening".
 */
export async function GET() {
  await reconcileThrottled();

  const [runs, jobs] = await Promise.all([listRuns(25), Promise.resolve(listJobs(10))]);

  return NextResponse.json({ runs, jobs, scheduler: schedulerSnapshot() });
}
