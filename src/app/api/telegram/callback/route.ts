import { NextResponse } from "next/server";

import { getPost } from "@/lib/repositories/posts-repository";
import { guardTelegramWebhook } from "@/lib/security/guards";
import { handleCallback } from "@/lib/telegram";
import type { TelegramCallbackAction } from "@/types";

export const dynamic = "force-dynamic";

interface CallbackBody {
  action?: string;
  postId?: string;
  from?: string;
  callbackQueryId?: string;
}

/**
 * Button presses from the Telegram notification land here and run the exact
 * same decision code as the dashboard, so the two surfaces can never disagree
 * about state.
 *
 * This endpoint approves and rejects real content, so it is gated: the secret
 * Telegram echoes back in `X-Telegram-Bot-Api-Secret-Token` must match, and if
 * no secret is configured the route refuses every request rather than
 * defaulting to open. An unauthenticated approve endpoint is worse than no
 * notification at all.
 */
export async function POST(request: Request) {
  // Constant-time secret comparison; refuses when unset, and never accepts a
  // same-origin call. See lib/security/guards.ts.
  const denied = guardTelegramWebhook(request);
  if (denied) return denied;

  let body: CallbackBody;
  try {
    body = (await request.json()) as CallbackBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const action = body.action as TelegramCallbackAction | undefined;
  if (action !== "approve" && action !== "reject") {
    return NextResponse.json(
      { error: "action must be 'approve' or 'reject'" },
      { status: 400 },
    );
  }

  if (typeof body.postId !== "string" || body.postId === "") {
    return NextResponse.json({ error: "postId is required" }, { status: 400 });
  }

  const post = await getPost(body.postId);
  if (!post) {
    return NextResponse.json(
      { error: `No post with id ${body.postId}` },
      { status: 404 },
    );
  }

  const result = await handleCallback({
    action,
    postId: body.postId,
    fromName: body.from?.trim() || "Telegram",
    callbackQueryId: body.callbackQueryId,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error ?? "Callback failed" },
      { status: 400 },
    );
  }

  return NextResponse.json(result);
}
