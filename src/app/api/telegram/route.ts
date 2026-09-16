import { NextResponse } from "next/server";

import { readTelegramLog, telegramStatus } from "@/lib/telegram";

export const dynamic = "force-dynamic";

/** Configuration state + recent activity, rendered in Settings → Telegram. */
export async function GET() {
  const status = await telegramStatus();
  const log = await readTelegramLog(20);
  return NextResponse.json({ status, log });
}
