import { NextResponse } from "next/server";

import { analysePost } from "@/lib/insights/engine";
import {
  getPostInsight,
  listPostInsights,
} from "@/lib/repositories/insights-repository";

export const dynamic = "force-dynamic";

/**
 * GET /api/insights/{postId} — everything the post analytics panel shows.
 *
 * Accepts either the warehouse id or the queue id, because the person clicking
 * through from the queue has the queue's id and should not have to know that
 * the two differ.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ postId: string }> },
) {
  const { postId } = await context.params;

  const insight = await getPostInsight(postId);
  if (!insight) {
    return NextResponse.json(
      { error: `No insights for post ${postId}` },
      { status: 404 },
    );
  }

  const peers = await listPostInsights();
  return NextResponse.json({ analytics: analysePost(insight, peers) });
}
