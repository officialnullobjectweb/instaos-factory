import { NextResponse } from "next/server";

import { processDueEntries } from "@/lib/repositories/schedule-repository";
import { guardScheduler } from "@/lib/security/guards";

export const dynamic = "force-dynamic";

/**
 * One scheduler tick.
 *
 * Called by Vercel Cron (`vercel.json`, which sends GET) and by the GitHub
 * Actions cron via the runner script with the secret header (POST), plus the
 * "Run scheduler now" button on the Schedule page. One code path either way,
 * so a local run, a Vercel run and a CI run behave identically.
 */
export async function POST(request: Request) {
  // Accepts the scheduler secret, the Vercel cron secret, or a same-origin
  // call from the dashboard button. Refuses outright in production when no
  // secret is configured — see lib/security/guards.ts.
  const denied = guardScheduler(request);
  if (denied) return denied;

  const result = await processDueEntries();
  return NextResponse.json({ ...result, at: new Date().toISOString() });
}

/**
 * GET — the shape Vercel Cron actually sends. It is not configurable, so the
 * cron lives here as an alias of the POST handler: same guard, same tick,
 * same response. Declared separately so the method is explicit in the logs.
 */
export async function GET(request: Request) {
  return POST(request);
}
