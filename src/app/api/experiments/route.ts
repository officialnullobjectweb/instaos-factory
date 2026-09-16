import { NextResponse } from "next/server";
import { z } from "zod";

import {
  listDecisions,
  recordDecision,
  resetDecisions,
} from "@/lib/repositories/experiments-repository";

export const dynamic = "force-dynamic";

const decisionSchema = z.object({
  subNicheId: z.string().min(1).max(60),
  audienceId: z.string().min(1).max(60),
  winnerId: z.string().min(1).max(80),
  loserId: z.string().min(1).max(80),
  metrics: z.object({
    reach: z.number().min(0),
    engagementRate: z.number().min(0).max(100),
    saves: z.number().min(0),
    follows: z.number().min(0),
  }),
  note: z.string().max(300).default(""),
});

/** GET /api/experiments — every recorded verdict, newest first. */
export async function GET() {
  const decisions = await listDecisions();
  return NextResponse.json({ decisions });
}

/** POST /api/experiments — record (or overwrite) a test verdict. */
export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = decisionSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid decision",
        detail: parsed.error.issues
          .map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`)
          .join("; "),
      },
      { status: 400 },
    );
  }

  const decision = await recordDecision(parsed.data);
  return NextResponse.json({ decision }, { status: 201 });
}

/** DELETE /api/experiments — clear the ledger. */
export async function DELETE() {
  const removed = await resetDecisions();
  return NextResponse.json({ ok: true, removed });
}
