import { NextResponse } from "next/server";

import {
  clearLogs,
  listLogs,
  summariseLogs,
} from "@/lib/repositories/ai-logs-repository";
import type { AiLogStep, AiProviderId } from "@/types";

export const dynamic = "force-dynamic";

const STEPS: AiLogStep[] = [
  "topic",
  "research",
  "verify",
  "carousel",
  "caption",
  "hashtags",
  "alt_text",
  "quality",
  "repair",
  "test",
];

const PROVIDERS: AiProviderId[] = ["gemini", "groq", "openrouter", "local"];

function isStep(value: string | null): value is AiLogStep {
  return value !== null && (STEPS as string[]).includes(value);
}

function isProvider(value: string | null): value is AiProviderId {
  return value !== null && (PROVIDERS as string[]).includes(value);
}

/** GET /api/ai/logs?limit=&step=&provider=&status= — newest first. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const limit = Math.min(
    Math.max(Number(url.searchParams.get("limit") ?? 60) || 60, 1),
    200,
  );

  const step = url.searchParams.get("step");
  const provider = url.searchParams.get("provider");
  const status = url.searchParams.get("status");

  const [logs, summary] = await Promise.all([
    listLogs({
      limit,
      step: isStep(step) ? step : "all",
      provider: isProvider(provider) ? provider : "all",
      status: status === "success" || status === "error" ? status : "all",
    }),
    summariseLogs(),
  ]);

  return NextResponse.json({ logs, summary });
}

/** DELETE /api/ai/logs — clears the audit trail. */
export async function DELETE() {
  const removed = await clearLogs();
  return NextResponse.json({ ok: true, removed });
}
