import { NextResponse } from "next/server";

import { getJob } from "@/lib/ai/jobs";
import { getPost } from "@/lib/repositories/posts-repository";

export const dynamic = "force-dynamic";

/**
 * GET /api/ai/generate/[id] — job progress.
 *
 * Once the job succeeds the created post is included, so the client can insert
 * it into the queue without a second round trip.
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

  const post = job.postId ? await getPost(job.postId) : null;

  return NextResponse.json({ job, post });
}
