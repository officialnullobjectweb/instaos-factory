import type {
  AiJob,
  AiLogEntry,
  AiLogSummary,
  AiProviderDescriptor,
  BrandId,
  GenerationRun,
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

export interface GenerationAccepted {
  job: AiJob;
  /** True when the run is waiting for a provider slot rather than starting now. */
  queued: boolean;
  /** 1-based place in line, when `queued`. */
  position: number | null;
  /** True when an identical run was already in flight and was returned instead. */
  deduplicated: boolean;
  /** How long the server allows a run to take, so the client waits that long. */
  budgetMs: number;
}

/**
 * Admits a generation request.
 *
 * The response is an acknowledgement, not a result: the run may start now or wait
 * its turn, and the server tells the caller which.
 */
export async function startGeneration(
  input: StartGenerationInput,
): Promise<GenerationAccepted> {
  return request<GenerationAccepted>("/api/ai/generate", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** What continuing a failed run would cost. */
export interface ResumePreview {
  canResume: boolean;
  summary: string;
  reusable: string[];
  pending: string[];
  tokensAlreadySpent: number;
}

export async function previewResume(runId: string) {
  return request<ResumePreview>(`/api/ai/runs/${runId}/resume`, { cache: "no-store" });
}

/** Continues a failed run from its checkpoint. */
export async function resumeRun(runId: string): Promise<GenerationAccepted & { resumedFrom: string }> {
  return request<GenerationAccepted & { resumedFrom: string }>(
    `/api/ai/runs/${runId}/resume`,
    { method: "POST" },
  );
}

/** What a poll returns: the live job, its post once written, and its durable run. */
export interface JobSnapshot {
  job: AiJob;
  post: Post | null;
  run: GenerationRun | null;
  /** Set when the failed run behind this job can be continued rather than repeated. */
  resume: { runId: string; summary: string; tokensAlreadySpent: number } | null;
}

export async function fetchJob(id: string): Promise<JobSnapshot> {
  return request<JobSnapshot>(`/api/ai/generate/${id}`, { cache: "no-store" });
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

/**
 * Every generation attempt, newest first, plus the jobs still in flight.
 *
 * Runs are the durable record — including the ones that failed and left no post
 * behind — while the jobs carry live step progress within the current process.
 */
export async function fetchRuns(options: { limit?: number } = {}) {
  const params = new URLSearchParams();
  if (options.limit) params.set("limit", String(options.limit));
  const query = params.toString();

  return request<{
    runs: GenerationRun[];
    jobs: AiJob[];
    scheduler: { running: number; queued: number; limit: number };
  }>(`/api/ai/runs${query ? `?${query}` : ""}`, { cache: "no-store" });
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
export interface PollOptions {
  intervalMs?: number;
  /** The server's run budget, returned when the request was accepted. */
  budgetMs?: number;
  onTick?: (job: AiJob) => void;
}

/** Fallback ceiling when the caller did not pass the server's budget. */
const FALLBACK_BUDGET_MS = 20 * 60_000;

/** A run may legitimately take a while; the ceiling is a backstop, not a deadline. */
const CEILING_MARGIN_MS = 60_000;

/** Consecutive failed polls tolerated before the client admits it lost contact. */
const MAX_TRANSIENT_FAILURES = 12;

/**
 * Waits for the server's verdict on a run.
 *
 * The client does not decide that a run failed. That call belongs to the server,
 * which knows the run's budget, records every step, and writes the failure with the
 * step and reason attached — and a browser-side stopwatch was previously the reason
 * healthy runs were reported as failures. A real run of this pipeline takes five to
 * ten minutes, so any client deadline short enough to feel responsive is shorter
 * than the work itself.
 *
 * What the client does own is not hanging: transient poll failures are retried, and
 * the ceiling is deliberately a minute past the server's own budget, so it can only
 * fire after the server has already had its say.
 */
export async function pollJob(
  id: string,
  options: PollOptions = {},
): Promise<JobSnapshot> {
  const interval = options.intervalMs ?? 1_000;
  const deadline =
    Date.now() + (options.budgetMs ?? FALLBACK_BUDGET_MS) + CEILING_MARGIN_MS;
  let failures = 0;

  for (;;) {
    try {
      const result = await fetchJob(id);
      failures = 0;
      options.onTick?.(result.job);

      if (result.job.status === "succeeded" || result.job.status === "failed") {
        return result;
      }
    } catch (error) {
      // A job that no longer exists is not transient: in-memory jobs do not
      // survive a restart or eviction, so the honest answer is that this process
      // can no longer see the run — its record is in the runs panel either way.
      if (error instanceof AiApiError && error.status === 404) {
        throw new AiApiError(
          "The server restarted while this run was in flight",
          404,
          "Its progress is not lost — the Generation runs panel below the queue has the full record.",
        );
      }

      failures += 1;
      if (failures >= MAX_TRANSIENT_FAILURES) {
        throw new AiApiError(
          "Lost contact with the server",
          503,
          "The run may still be finishing. Check the Generation runs panel below the queue.",
        );
      }
    }

    if (Date.now() > deadline) {
      throw new AiApiError(
        "This run is taking longer than its budget",
        504,
        "The engine stops runs that exceed it and records why — see the Generation runs panel below the queue.",
      );
    }

    await new Promise((resolve) => setTimeout(resolve, interval));
  }
}

export const aiApi = {
  start: startGeneration,
  job: fetchJob,
  poll: pollJob,
  runs: fetchRuns,
  resume: resumeRun,
  previewResume,
  logs: fetchLogs,
  clearLogs,
  providers: fetchProviders,
  testProvider,
} as const;
