import { NextResponse } from "next/server";

import {
  createPost,
  listPosts,
} from "@/lib/repositories/posts-repository";
import type { Post } from "@/types";

/** The queue always reads from disk so edits from the API are never stale. */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const posts = await listPosts();
    return NextResponse.json({ posts });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to read the posts dataset",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { post?: Post };

    if (!body.post) {
      return NextResponse.json({ error: "Missing post payload" }, { status: 400 });
    }

    const created = await createPost(body.post);
    return NextResponse.json({ post: created }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to create the post",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
