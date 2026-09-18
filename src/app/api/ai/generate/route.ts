import { NextResponse } from "next/server";
import { z } from "zod";

import { AI_ENV, configuredProviders } from "@/lib/ai/providers";
import { schedulerSnapshot, submitGeneration } from "@/lib/ai/scheduler";
import { limitOr429 } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  brandId: z.enum(["midnight-ritual", "studio-noir", "daily-grind"]),
  steer: z.string().max(400).optional(),
  owner: z.string().max(80).optional(),
});

/**
 * POST /api/ai/generate — accepts a generation request and returns immediately.
 *
 * The request is *admitted*, not started: the scheduler decides whether it runs
 * now or waits its turn behind the runs already holding a provider. That
 * distinction is the whole point of this route. A nine-step pipeline takes five to
 * ten minutes, providers rate-limit per key, and starting every request the moment
 * it arrives means each one spends its retry budget collecting 429s — so all of
 * them fail slower instead of any of them succeeding.
 *
 * The response carries the budget the client should wait for, so the browser never
 * has to invent a deadline of its own. The server is the only party that knows how
 * long a run is allowed to take, and a client-side guess was previously the reason
 * runs that were working perfectly were reported as failures.
 */
export async function POST(request: Request) {
  const limited = await limitOr429(request, {
    route: "ai-generate",
    name: "ai-generate",
    limit: 10,
    windowSeconds: 60,
  });
  if (limited) return limited;

  const providers = configuredProviders();

  if (providers.length === 0) {
    return NextResponse.json(
      {
        error: "No AI provider is configured",
        detail: "Add NARA_API_KEY or GROQ_API_KEY to .env, then restart the server.",
      },
      { status: 503 },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid generation request",
        detail: parsed.error.issues
          .map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`)
          .join("; "),
      },
      { status: 400 },
    );
  }

  const result = await submitGeneration(parsed.data);

  return NextResponse.json(
    {
      job: result.job,
      queued: result.queued,
      position: result.position,
      deduplicated: result.deduplicated,
      /** How long a run may take, so the client waits for the server's verdict. */
      budgetMs: AI_ENV.jobBudgetMs,
      scheduler: schedulerSnapshot(),
    },
    { status: 202 },
  );
}

export async function GET() {
  return NextResponse.json({
    scheduler: schedulerSnapshot(),
    providers: configuredProviders().map((provider) => ({
      id: provider.id,
      label: provider.label,
      model: provider.model,
      priority: provider.priority,
    })),
  });
}
