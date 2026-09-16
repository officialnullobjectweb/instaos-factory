import { NextResponse } from "next/server";
import { z } from "zod";

import { runGeneration } from "@/lib/ai/flow";
import { createJob, listJobs } from "@/lib/ai/jobs";
import { configuredProviders } from "@/lib/ai/providers";
import { limitOr429 } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  brandId: z.enum(["midnight-ritual", "studio-noir", "daily-grind"]),
  category: z.enum(["Geography", "Psychology", "Branding"]).optional(),
  steer: z.string().max(400).optional(),
  granular: z.boolean().optional(),
  owner: z.string().max(80).optional(),
  /** Experiment metadata: which sub-niche/variant/audience this post serves. */
  subNicheId: z.string().max(60).optional(),
  variantId: z.string().max(80).optional(),
  audienceId: z.string().max(60).optional(),
});

/**
 * POST /api/ai/generate — starts a generation job.
 *
 * The eight-step pipeline takes tens of seconds, so this returns as soon as the
 * job is registered and the client polls `GET /api/ai/generate/[id]`. The run
 * continues in this process; anything that completes lands in `posts.json`, so a
 * restart loses the job's progress, never the post.
 */
export async function POST(request: Request) {
  // Generation is the most expensive thing the app does — provider quota on
  // every call — so it is the first thing a stuck client can burn. Ten runs
  // per minute per caller is far above any human pace.
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
        detail:
          "Add GEMINI_API_KEY (primary) and optionally GROQ_API_KEY / OPENROUTER_API_KEY to .env.local, then restart the server.",
        requiredEnvVars: ["GEMINI_API_KEY", "GROQ_API_KEY", "OPENROUTER_API_KEY"],
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

  const job = createJob(parsed.data.brandId);

  // Deliberately not awaited: the job tracks its own progress.
  void runGeneration(job.id, parsed.data).catch(() => undefined);

  return NextResponse.json({ job }, { status: 202 });
}

export async function GET() {
  return NextResponse.json({
    jobs: listJobs(10),
    providers: configuredProviders().map((provider) => ({
      id: provider.id,
      label: provider.label,
      model: provider.model,
      priority: provider.priority,
    })),
  });
}
