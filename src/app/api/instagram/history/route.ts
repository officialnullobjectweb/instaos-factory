import { NextResponse } from "next/server";

import {
  listHistory,
  summariseHistory,
} from "@/lib/repositories/instagram-history-repository";

export const dynamic = "force-dynamic";

/** Publish history + summary — rendered in Analytics → Publishing. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 50) || 50, 200);

  const [records, summary] = await Promise.all([
    listHistory(limit),
    summariseHistory(),
  ]);

  return NextResponse.json({ records, summary });
}
