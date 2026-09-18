import { NextResponse } from "next/server";

import { canResume, pendingSteps, reusableSteps, resumeSummary } from "@/lib/ai/checkpoint";
import { AI_ENV, configuredProviders } from "@/lib/ai/providers";
import { schedulerSnapshot, submitGeneration } from "@/lib/ai/scheduler";
import { getRun } from "@/lib/repositories/generation-runs-repository";
import { limitOr429 } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

/**
 * GET /api/ai/runs/[id]/resume — what continuing this run would cost.
 *
 * The confirmation dialog reads this, so the saving is stated before the button is
 * pressed rather than discovered in the run report afterwards.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const run = await getRun(id);

  if (!run) {
    return NextResponse.json({ error: `No run with id ${id}` }, { status: 404 });
  }

  return NextResponse.json({
    canResume: canResume(run),
    summary: resumeSummary(run),
    reusable: reusableSteps(run),
    pending: pendingSteps(run),
    tokensAlreadySpent: run.tokens,
  });
}

/**
 * POST /api/ai/runs/[id]/resume — continues a failed run from where it stopped.
 *
 * Refuses anything that is not a failed run with a stored checkpoint. Both halves
 * matter: continuing a run that already succeeded would create a second post from
 * the same brief, and continuing one with nothing checkpointed is not a resume at
 * all — it is a fresh generation wearing a misleading label, and it would spend
 * the full budget while the operator believed they were paying for a fraction.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const limited = await limitOr429(request, {
    route: "ai-resume",
    name: "ai-resume",
    limit: 10,
    windowSeconds: 60,
  });
  if (limited) return limited;

  const { id } = await context.params;
  const run = await getRun(id);

  if (!run) {
    return NextResponse.json({ error: `No run with id ${id}` }, { status: 404 });
  }

  if (run.status === "running") {
    return NextResponse.json(
      { error: "That run is already in progress", detail: "Nothing to resume yet." },
      { status: 409 },
    );
  }

  if (!canResume(run)) {
    return NextResponse.json(
      {
        error: "That run cannot be continued",
        detail:
          run.status !== "failed"
            ? "Only failed runs can be resumed."
            : "It did not finish any step, so a retry would start from the beginning.",
      },
      { status: 409 },
    );
  }

  if (configuredProviders().length === 0) {
    return NextResponse.json(
      {
        error: "No AI provider is configured",
        detail: "Add NARA_API_KEY or GROQ_API_KEY to .env, then restart the server.",
      },
      { status: 503 },
    );
  }

  const { job, queued, position, deduplicated } = await submitGeneration(
    {
      brandId: run.brandId,
      steer: run.request.steer ?? undefined,
      owner: run.request.owner ?? undefined,
    },
    {
      resumeFrom: run,
      // The whole job's spend, so the finished run reports what it actually cost
      // rather than only what its final attempt cost.
      tokensCarried: run.tokens,
    },
  );

  if (deduplicated) {
    // Answering "resumed" here would be a lie: the scheduler matched this brand to
    // a run already in flight and did not start anything.
    return NextResponse.json(
      {
        error: "A run for this brand is already in flight",
        detail: `Job ${job.id} is ${job.status}. Wait for it to finish, then resume if it failed.`,
        job,
      },
      { status: 409 },
    );
  }

  return NextResponse.json(
    {
      job,
      queued,
      position,
      resumedFrom: run.id,
      budgetMs: AI_ENV.jobBudgetMs,
      scheduler: schedulerSnapshot(),
    },
    { status: 202 },
  );
}
