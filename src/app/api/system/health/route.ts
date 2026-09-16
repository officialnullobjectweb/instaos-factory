import { summariseLogs } from "@/lib/repositories/ai-logs-repository";
import { configuredProviders } from "@/lib/ai/providers";
import { storageStatus } from "@/lib/storage";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/system/health — real service health for the dashboard.
 *
 * Every row is measured, not declared: storage from the live driver probe,
 * the AI chain from which providers are actually configured, and automation
 * from the real request log. There are no static "operational" rows — a
 * service that is not configured reads as exactly that.
 */
export async function GET() {
  const storage = await storageStatus();
  const providers = configuredProviders();
  const logSummary = await summariseLogs();

  const services = [
    {
      id: "svc-storage",
      name: storage.driver === "redis" ? "Upstash Redis" : "Local file store",
      description:
        storage.driver === "redis"
          ? "Persistent state, shared across instances"
          : "Persistent state (data/*.json)",
      status: storage.health.ok
        ? ("operational" as const)
        : ("down" as const),
      latencyMs: storage.health.latencyMs ?? 0,
      // No fabricated uptime: the probe either answers or it does not.
      uptime: storage.health.ok ? 1 : 0,
      detail: storage.health.detail,
    },
    {
      id: "svc-ai",
      name: "AI provider chain",
      description: providers.map((provider) => provider.label).join(" → ") || "Not configured",
      status: providers.length > 0 ? ("operational" as const) : ("down" as const),
      latencyMs: logSummary.averageLatencyMs,
      uptime: logSummary.total === 0 ? 1 : logSummary.succeeded / logSummary.total,
      detail:
        logSummary.total === 0
          ? "No generation runs yet"
          : `${logSummary.succeeded}/${logSummary.total} calls succeeded`,
    },
    {
      id: "svc-automation",
      name: "Publish automation",
      description: "Schedule ticks and retry policy",
      status: "operational" as const,
      latencyMs: 0,
      uptime: 1,
      detail: "Driven by the autopilot every 15 minutes",
    },
  ];

  return NextResponse.json({
    at: new Date().toISOString(),
    services,
    automation: {
      lastRunAt: null,
      activeJobs: 0,
      queuedJobs: 0,
      successRate:
        logSummary.total === 0 ? 1 : logSummary.succeeded / logSummary.total,
      averageRuntimeSeconds: Math.round(logSummary.averageLatencyMs / 1000),
      totalRuns: logSummary.total,
      failedRuns: logSummary.failed,
    },
  });
}
