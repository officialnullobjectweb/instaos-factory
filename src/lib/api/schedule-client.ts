import type {
  AuditEntry,
  ScheduleEntry,
  TelegramLogEntry,
  TelegramStatus,
} from "@/types";

/**
 * Typed fetch layer for the scheduling surfaces. Mirrors the posts client:
 * plain functions, explicit errors, no hidden retries — the caller decides
 * how to surface a failure.
 */

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });

  const payload = (await response.json().catch(() => null)) as
    | (T & { error?: string })
    | null;

  if (!response.ok || payload === null) {
    throw new Error(payload?.error ?? `Request failed (${response.status})`);
  }
  return payload;
}

export async function fetchSchedule(): Promise<ScheduleEntry[]> {
  const { entries } = await request<{ entries: ScheduleEntry[] }>("/api/schedule");
  return entries;
}

export interface SchedulePostInput {
  postId: string;
  scheduledFor: string;
  igPage?: string;
  approvedBy?: string;
}

export async function schedulePost(
  input: SchedulePostInput,
): Promise<ScheduleEntry> {
  const { entry } = await request<{ entry: ScheduleEntry }>("/api/schedule", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return entry;
}

export async function rescheduleSlot(
  id: string,
  scheduledFor: string,
): Promise<ScheduleEntry> {
  const { entry } = await request<{ entry: ScheduleEntry }>(`/api/schedule/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ scheduledFor }),
  });
  return entry;
}

export async function withdrawSlot(id: string): Promise<void> {
  await request<{ ok: true }>(`/api/schedule/${id}`, { method: "DELETE" });
}

export async function retrySlot(id: string): Promise<ScheduleEntry> {
  const { entry } = await request<{ entry: ScheduleEntry }>(
    `/api/schedule/${id}/retry`,
    { method: "POST" },
  );
  return entry;
}

export interface TickResult {
  processed: number;
  published: number;
  failed: number;
  at: string;
}

export async function runSchedulerTick(): Promise<TickResult> {
  return request<TickResult>("/api/schedule/process", { method: "POST" });
}

export interface TelegramInfo {
  status: TelegramStatus;
  log: TelegramLogEntry[];
}

export async function fetchTelegramInfo(): Promise<TelegramInfo> {
  return request<TelegramInfo>("/api/telegram");
}

export async function fetchAudit(query: {
  actions?: string[];
  entityId?: string;
  search?: string;
  limit?: number;
}): Promise<AuditEntry[]> {
  const params = new URLSearchParams();
  for (const action of query.actions ?? []) params.append("action", action);
  if (query.entityId) params.set("entityId", query.entityId);
  if (query.search) params.set("q", query.search);
  if (query.limit) params.set("limit", String(query.limit));

  const { entries } = await request<{ entries: AuditEntry[] }>(
    `/api/audit?${params.toString()}`,
  );
  return entries;
}
