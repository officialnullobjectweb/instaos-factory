import { NextResponse } from "next/server";

import { appendAudit } from "@/lib/repositories/audit-repository";
import { duplicatePost } from "@/lib/repositories/posts-repository";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  try {
    const post = await duplicatePost(id);

    if (!post) {
      return NextResponse.json({ error: `No post with id ${id}` }, { status: 404 });
    }

    await appendAudit({
      action: "duplicated",
      entityType: "post",
      entityId: post.id,
      postTitle: post.title,
      actor: { name: "Kamal Dhiver", email: "kamal.dhiver@factory.local" },
      detail: `Duplicated from ${id}`,
    });

    return NextResponse.json({ post }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to duplicate the post",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
