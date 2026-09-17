import { NextResponse } from "next/server";
import { z } from "zod";

import { runGenerationV2 } from "@/lib/ai/flow-v2";
import { createJob, listJobs } from "@/lib/ai/jobs";
import { configuredProviders } from "@/lib/ai/providers";
import { limitOr429 } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  brandId: z.enum(["midnight-ritual", "studio-noir", "daily-grind"]),
  steer: z.string().max(400).optional(),
  owner: z.string().max(80).optional(),
});

/**
 * POST /api/ai/generate — starts a generation job using the v2 pipeline.
 *
 * v2 pipeline:
 * 1. Topic Scoring (70% effort) — generate 8 candidates, score, pick best
 * 2. Deep Research — trusted sources, multiple viewpoints, critiques
 * 3. Content Writing — visual-first, simple, engaging
 * 4. Design Selection — match content to best visual approach
 * 5. Quality Review — score and approve/reject
 * 6. Final Polish — hashtags, caption, alt text
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

  const job = createJob(parsed.data.brandId);

  // Deliberately not awaited: the job tracks its own progress.
  void runGenerationV2(job.id, parsed.data).catch(() => undefined);

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
