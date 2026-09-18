import { NextResponse } from "next/server";

import { canResume, resumeSummary } from "@/lib/ai/checkpoint";
import { getJob } from "@/lib/ai/jobs";
import { schedulerSnapshot } from "@/lib/ai/scheduler";
import { findRunByJob } from "@/lib/repositories/generation-runs-repository";
import { getPost } from "@/lib/repositories/posts-repository";

export const dynamic = "force-dynamic";

/**
 * GET /api/ai/generate/[id] — job progress, plus the durable run behind it.
 *
 * The job answers "what is happening now"; the run answers "what happened", and it
 * is the only one that survives a restart. Returning both means the client can tell
 * a failed run it can continue from one it has to repeat, without a second request
 * at the exact moment someone is waiting to find out what went wrong.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const job = getJob(id);

  if (!job) {
    return NextResponse.json({ error: `No job with id ${id}` }, { status: 404 });
  }

  const [post, run] = await Promise.all([
    job.postId ? getPost(job.postId) : Promise.resolve(null),
    findRunByJob(job.id),
  ]);

  return NextResponse.json({
    job,
    post,
    run,
    /** What continuing this run would reuse — null when there is nothing to continue. */
    resume: run && canResume(run)
      ? {
          runId: run.id,
          summary: resumeSummary(run),
          tokensAlreadySpent: run.tokens,
        }
      : null,
    scheduler: schedulerSnapshot(),
  });
}
