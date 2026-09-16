import { NextResponse } from "next/server";

import type { AuditActor } from "@/types";
import {
  getScheduleEntry,
  retryEntry,
} from "@/lib/repositories/schedule-repository";
import { MAX_RETRIES } from "@/lib/scheduling/rules";

export const dynamic = "force-dynamic";

const ACTOR: AuditActor = {
  name: "Kamal Dhiver",
  email: "kamal.dhiver@factory.local",
};

/** Manual retry of a failed slot. The cap is enforced in the repository. */
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  const existing = await getScheduleEntry(id);
  if (!existing) {
    return NextResponse.json({ error: `No slot with id ${id}` }, { status: 404 });
  }

  if (existing.status !== "failed") {
    return NextResponse.json(
      { error: "Only failed slots can be retried" },
      { status: 409 },
    );
  }

  if (existing.retryCount >= MAX_RETRIES) {
    return NextResponse.json(
      {
        error: `Retry cap reached (${MAX_RETRIES}). Reschedule the post instead.`,
      },
      { status: 409 },
    );
  }

  const entry = await retryEntry(id, ACTOR);
  if (!entry) {
    return NextResponse.json({ error: `No slot with id ${id}` }, { status: 404 });
  }

  return NextResponse.json({ entry });
}
