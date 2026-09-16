import type {
  AiJob,
  AiLogEntry,
  AiLogSummary,
  AiProviderDescriptor,
  BrandId,
  Post,
  PostCategory,
} from "@/types";

/**
 * The client's only route to the AI engine. Same contract as the posts client:
 * typed, one place to change transport, and errors that carry the server's
 * explanation rather than a generic failure.
 */

export class AiApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly detail?: string,
    readonly requiredEnvVars?: string[],
  ) {
    super(message);
    this.name = "AiApiError";
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: string; detail?: string; requiredEnvVars?: string[] }
      | null;

    throw new AiApiError(
      payload?.error ?? `Request failed (${response.status})`,
      response.status,
      payload?.detail,
      payload?.requiredEnvVars,
    );
  }

  return (await response.json()) as T;
}

export interface StartGenerationInput {
  brandId: BrandId;
  category?: PostCategory;
  steer?: string;
  granular?: boolean;
  /** Experiment attribution, persisted on the generated post. */
  subNicheId?: string;
  variantId?: string;
  audienceId?: string;
}

export async function startGeneration(input: StartGenerationInput) {
  const { job } = await request<{ job: AiJob }>("/api/ai/generate", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return job;
}

export async function fetchJob(id: string) {
  return request<{ job: AiJob; post: Post | null }>(`/api/ai/generate/${id}`, {
    cache: "no-store",
  });
}

export async function fetchLogs(options: { limit?: number } = {}) {
  const params = new URLSearchParams();
  if (options.limit) params.set("limit", String(options.limit));
  const query = params.toString();

  return request<{ logs: AiLogEntry[]; summary: AiLogSummary }>(
    `/api/ai/logs${query ? `?${query}` : ""}`,
    { cache: "no-store" },
  );
}

export async function clearLogs() {
  return request<{ ok: boolean; removed: number }>("/api/ai/logs", {
    method: "DELETE",
  });
}

export async function fetchProviders() {
  return request<{ providers: AiProviderDescriptor[]; ready: boolean }>(
    "/api/ai/providers",
    { cache: "no-store" },
  );
}

export interface ProviderTestResult {
  ok: boolean;
  provider: string;
  model?: string;
  latencyMs?: number;
  grounded?: boolean;
  sample?: unknown;
  kind?: string;
  error?: string;
}

export async function testProvider(id: string) {
  return request<ProviderTestResult>(`/api/ai/providers/${id}/test`, {
    method: "POST",
  });
}

/**
 * Polls a job until it settles. Returns the finished job plus the post the
 * server wrote, so the caller can put it straight into the queue.
 */
export async function pollJob(
  id: string,
  options: { intervalMs?: number; timeoutMs?: number; onTick?: (job: AiJob) => void } = {},
): Promise<{ job: AiJob; post: Post | null }> {
  const interval = options.intervalMs ?? 800;
  const deadline = Date.now() + (options.timeoutMs ?? 5 * 60_000);

  for (;;) {
    const result = await fetchJob(id);
    options.onTick?.(result.job);

    if (result.job.status === "succeeded" || result.job.status === "failed") {
      return result;
    }

    if (Date.now() > deadline) {
      throw new AiApiError("Generation timed out on the client", 504);
    }

    await new Promise((resolve) => setTimeout(resolve, interval));
  }
}

export const aiApi = {
  start: startGeneration,
  job: fetchJob,
  poll: pollJob,
  logs: fetchLogs,
  clearLogs,
  providers: fetchProviders,
  testProvider,
} as const;
