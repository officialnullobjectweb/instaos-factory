import { NextResponse } from "next/server";

import { getLearningState } from "@/lib/repositories/learning-repository";

export const dynamic = "force-dynamic";

/** GET /api/learning — the current weights plus the report history. */
export async function GET() {
  const state = await getLearningState();
  return NextResponse.json({
    state,
    /** True when no analysis has ever run, so the UI can say so plainly. */
    empty: state.latest === null,
  });
}
