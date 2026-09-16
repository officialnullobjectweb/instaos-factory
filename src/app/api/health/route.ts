import { NextResponse } from "next/server";

import { envReport, serverEnv } from "@/lib/env";
import { storageStatus } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * GET /api/health — the first thing to check when a deployment misbehaves.
 *
 * Returns what an operator needs and nothing a stranger can use: whether the
 * persistent store answers, which driver is live, and which optional services
 * are configured. Secrets are never included — `envReport` reports presence,
 * not values.
 *
 * In production a broken store is a 503 so uptime monitors page on it; in
 * development it stays 200 so the dashboard is usable while things are being
 * set up.
 */
export async function GET() {
  const env = serverEnv();

  let status: Awaited<ReturnType<typeof storageStatus>>;
  try {
    status = await storageStatus();
  } catch (error) {
    status = {
      driver: "file",
      durable: false,
      health: {
        ok: false,
        detail:
          error instanceof Error
            ? error.message
            : "The store could not be reached for an unknown reason.",
      },
    };
  }

  const degraded = status.driver === "redis" && !status.health.ok;

  return NextResponse.json(
    {
      ok: !degraded,
      at: new Date().toISOString(),
      environment: env.NODE_ENV,
      storage: {
        driver: status.driver,
        durable: status.durable,
        ok: status.health.ok,
        detail: status.health.detail,
        ...(status.health.latencyMs !== undefined
          ? { latencyMs: status.health.latencyMs }
          : {}),
      },
      services: envReport(),
    },
    { status: degraded ? 503 : 200 },
  );
}
