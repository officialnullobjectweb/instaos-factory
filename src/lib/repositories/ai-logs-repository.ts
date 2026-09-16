import { randomUUID } from "node:crypto";

import { arrayDocument } from "@/lib/storage";
import type {
  AiLogEntry,
  AiLogStep,
  AiLogSummary,
  AiProviderId,
} from "@/types";

/**
 * Request/response storage for every model call.
 *
 * Capped so a long-running workspace cannot grow it without bound; oldest
 * entries drop first. Storage mechanics live in the shared document layer.
 */

const MAX_ENTRIES = 400;

/** Prompts are truncated before storage: enough to audit, cheap to keep. */
const MAX_TEXT = 12_000;

export interface NewLogEntry {
  jobId: string | null;
  step: AiLogStep;
  provider: AiProviderId;
  model: string;
  status: "success" | "error";
  attempt: number;
  latencyMs: number;
  request: AiLogEntry["request"];
  response: AiLogEntry["response"];
  error: AiLogEntry["error"];
  usage: AiLogEntry["usage"];
  repairs: string[];
}

function truncate(value: string) {
  if (value.length <= MAX_TEXT) return value;
  return `${value.slice(0, MAX_TEXT)}\n…[truncated ${value.length - MAX_TEXT} characters]`;
}

/** Drops rows the log UI could not render, rather than failing the page. */
function isLogEntry(raw: unknown): raw is AiLogEntry {
  if (typeof raw !== "object" || raw === null) return false;
  const entry = raw as Partial<AiLogEntry>;

  return (
    typeof entry.id === "string" &&
    typeof entry.step === "string" &&
    typeof entry.provider === "string" &&
    typeof entry.status === "string" &&
    typeof entry.model === "string" &&
    typeof entry.request === "object" &&
    entry.request !== null
  );
}

const logs = () =>
  arrayDocument<AiLogEntry>({
    key: "ai-logs",
    isItem: isLogEntry,
    maxItems: MAX_ENTRIES,
  });

export async function appendLog(input: NewLogEntry): Promise<AiLogEntry> {
  const entry: AiLogEntry = {
    id: `ailog-${randomUUID().slice(0, 8)}`,
    createdAt: new Date().toISOString(),
    ...input,
    request: {
      ...input.request,
      system: truncate(input.request.system),
      user: truncate(input.request.user),
    },
    response: input.response
      ? { text: truncate(input.response.text), parsed: input.response.parsed }
      : null,
  };

  await logs().prepend(entry);
  return entry;
}

export interface ListLogsOptions {
  limit?: number;
  step?: AiLogStep | "all";
  provider?: AiProviderId | "all";
  status?: "success" | "error" | "all";
}

export async function listLogs({
  limit = 60,
  step = "all",
  provider = "all",
  status = "all",
}: ListLogsOptions = {}): Promise<AiLogEntry[]> {
  const entries = await logs().read();

  return entries
    .filter((entry) => step === "all" || entry.step === step)
    .filter((entry) => provider === "all" || entry.provider === provider)
    .filter((entry) => status === "all" || entry.status === status)
    .slice(0, limit);
}

export async function getLog(id: string): Promise<AiLogEntry | null> {
  const entries = await logs().read();
  return entries.find((entry) => entry.id === id) ?? null;
}

export async function clearLogs(): Promise<number> {
  const entries = await logs().read();
  await logs().replaceAll([]);
  return entries.length;
}

export async function summariseLogs(): Promise<AiLogSummary> {
  const entries = await logs().read();

  const byProvider = new Map<AiProviderId, { total: number; failed: number }>();
  let latencyTotal = 0;
  let fallbackCalls = 0;

  for (const entry of entries) {
    const bucket = byProvider.get(entry.provider) ?? { total: 0, failed: 0 };
    bucket.total += 1;
    if (entry.status === "error") bucket.failed += 1;
    byProvider.set(entry.provider, bucket);

    latencyTotal += entry.latencyMs;
    if (entry.provider !== "gemini" && entry.provider !== "local") fallbackCalls += 1;
  }

  const failed = entries.filter((entry) => entry.status === "error").length;

  return {
    total: entries.length,
    succeeded: entries.length - failed,
    failed,
    byProvider: [...byProvider.entries()]
      .map(([provider, counts]) => ({ provider, ...counts }))
      .sort((a, b) => b.total - a.total),
    averageLatencyMs:
      entries.length === 0 ? 0 : Math.round(latencyTotal / entries.length),
    fallbackRate: entries.length === 0 ? 0 : fallbackCalls / entries.length,
    lastFailure:
      entries.find((entry) => entry.status === "error")?.error?.message ?? null,
  };
}
