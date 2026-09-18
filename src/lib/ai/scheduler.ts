import { AI_ENV } from "@/lib/ai/providers";
import {
  listRuns,
  updateRun,
} from "@/lib/repositories/generation-runs-repository";
import type { AiErrorKind, AiJob } from "@/types";

import type { GenerationInput, RunGenerationOptions } from "./flow-v2";
import { createJob, getJob, updateJob } from "./jobs";

/**
 * Who gets to run, and what happens when something goes wrong.
 *
 * The generation pipeline is nine sequential model calls that legitimately take
 * five to ten minutes. Three things follow from that, and this module is all
 * three:
 *
 *   1. **Runs queue.** Providers rate-limit per key, so starting four runs at once
 *      does not finish them four times sooner — they each spend their attempt
 *      budget collecting 429s, and all four fail slower. Past
 *      `AI_MAX_CONCURRENT_JOBS` a request waits its turn, with its position
 *      visible to whoever is waiting.
 *   2. **Nothing runs forever.** A step that stops making progress is a wedged
 *      run, not a slow one. The watchdog stops it, records the step it died on,
 *      frees the slot and lets the queue move — so one bad run can never take the
 *      factory with it.
 *   3. **Nothing is left claiming to be running.** A restart mid-run leaves a
 *      persisted run with no process behind it; reconciliation closes those out
 *      with an honest reason instead of a spinner that never stops.
 *
 * State lives on `globalThis` because Next can instantiate route modules more
 * than once per process, and the scheduler must be a singleton within it.
 */

/** A run that has been accepted but has not taken a slot yet. */
interface QueuedJob {
  jobId: string;
  input: GenerationInput;
  /** Resume payloads, when this request continues an earlier run. */
  options: RunGenerationOptions;
  queuedAt: string;
}

interface SchedulerState {
  /** Job ids currently holding a slot, oldest first. */
  running: string[];
  pending: QueuedJob[];
  /** Kept so a restart can explain what it interrupted. */
  inputs: Map<string, GenerationInput>;
  watchdog: ReturnType<typeof setInterval> | null;
}

const globalForScheduler = globalThis as unknown as {
  __factoryAiScheduler?: SchedulerState;
};

function state(): SchedulerState {
  if (!globalForScheduler.__factoryAiScheduler) {
    globalForScheduler.__factoryAiScheduler = {
      running: [],
      pending: [],
      inputs: new Map(),
      watchdog: null,
    };
  }
  return globalForScheduler.__factoryAiScheduler;
}

export interface SchedulerSnapshot {
  running: number;
  queued: number;
  limit: number;
}

export function schedulerSnapshot(): SchedulerSnapshot {
  const current = state();
  return {
    running: current.running.length,
    queued: current.pending.length,
    limit: AI_ENV.maxConcurrentJobs,
  };
}

export interface SubmitResult {
  job: AiJob;
  /** True when the run is waiting for a slot rather than starting now. */
  queued: boolean;
  /** 1-based place in line, only when `queued`. */
  position: number | null;
  /** True when an identical run was already waiting or in flight. */
  deduplicated: boolean;
}

/** A job that is accepted but not started yet, or already in flight. */
function activeJobForBrand(brandId: string): AiJob | null {
  const current = state();
  const ids = [...current.pending.map((entry) => entry.jobId), ...current.running];

  for (const id of ids) {
    const job = getJob(id);
    if (job?.brandId === brandId) return job;
  }
  return null;
}

/**
 * Accepts a generation request.
 *
 * A second request for a brand that already has a run waiting or in flight is
 * answered with that run rather than a new one. That is not a nicety: the most
 * common cause of a duplicate post is somebody pressing Generate again because
 * the first one looked stuck, and two runs produce two posts from the same brief.
 */
export async function submitGeneration(
  input: GenerationInput,
  options: RunGenerationOptions & { allowConcurrent?: boolean } = {},
): Promise<SubmitResult> {
  if (!options.allowConcurrent) {
    const existing = activeJobForBrand(input.brandId);
    if (existing) {
      const position = queuedPosition(existing.id);
      return {
        job: existing,
        queued: existing.status === "queued",
        position,
        deduplicated: true,
      };
    }
  }

  const job = createJob(input.brandId);
  const runOptions: RunGenerationOptions = {
    resumeFrom: options.resumeFrom ?? null,
    tokensCarried: options.tokensCarried ?? 0,
  };

  state().inputs.set(job.id, input);

  const capacity = AI_ENV.maxConcurrentJobs;
  if (state().running.length >= capacity) {
    state().pending.push({
      jobId: job.id,
      input,
      options: runOptions,
      queuedAt: new Date().toISOString(),
    });
    const position = queuedPosition(job.id);
    const queuedJob = updateJob(job.id, {
      status: "queued",
      queuePosition: position,
    });
    return {
      job: queuedJob ?? job,
      queued: true,
      position,
      deduplicated: false,
    };
  }

  start(job.id, input, runOptions);

  // Re-read rather than returning the snapshot from a moment ago: `start` has
  // already marked it running, and reporting "queued" for a run that is working
  // would have the client waiting behind nothing.
  return {
    job: getJob(job.id) ?? job,
    queued: false,
    position: null,
    deduplicated: false,
  };
}

/** 1-based line position, or null when the job is not waiting. */
function queuedPosition(jobId: string): number | null {
  const index = state().pending.findIndex((entry) => entry.jobId === jobId);
  return index === -1 ? null : index + 1;
}

/**
 * Runs one job and, whatever happens, gives its slot back.
 *
 * The `finally` is the whole point: a slot that leaks when a run throws is how a
 * scheduler quietly stops accepting work. Everything that settles a job — success,
 * failure, the watchdog — funnels through `release`.
 */
function start(
  jobId: string,
  input: GenerationInput,
  options: RunGenerationOptions,
): void {
  const current = state();
  current.running.push(jobId);
  updateJob(jobId, { status: "running", queuePosition: null });

  void (async () => {
    try {
      // Imported lazily: the flow pulls in every provider, and a request that is
      // merely queued should not pay for that at module load.
      const { runGenerationV2 } = await import("./flow-v2");
      await runGenerationV2(jobId, input, options);
    } catch {
      // The run records its own failure, with the step and the provider's words.
      // Nothing useful is left to do here beyond releasing the slot below.
    } finally {
      release(jobId);
    }
  })();
}

function release(jobId: string): void {
  const current = state();
  current.running = current.running.filter((id) => id !== jobId);
  current.inputs.delete(jobId);
  void pump();
}

/** Starts waiting jobs while slots are free. Safe to call at any time. */
export async function pump(): Promise<void> {
  const current = state();

  while (
    current.pending.length > 0 &&
    current.running.length < AI_ENV.maxConcurrentJobs
  ) {
    const next = current.pending.shift();
    if (!next) break;

    // A job can settle while queued (cancelled, or reconciled after a restart).
    const job = getJob(next.jobId);
    if (!job || job.status === "cancelled" || job.status === "failed") continue;

    start(next.jobId, next.input, next.options);
  }

  // Positions shifted for everyone still waiting.
  current.pending.forEach((entry, index) => {
    updateJob(entry.jobId, { queuePosition: index + 1 });
  });

  ensureWatchdog();
}

/* -------------------------------------------------------------------------- */
/*  The watchdog                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Why a run should be stopped, decided from timestamps alone.
 *
 * Pure, and separated out, because this is the rule that stops a wedged run from
 * holding the factory's only slot — worth a test that does not need a timer, a
 * network or a store.
 */
export function stallReason(input: {
  /** When the run started. */
  startedAt: string;
  /** When anything last moved — a step settling. */
  updatedAt: string;
  now: number;
  budgetMs: number;
  stallMs: number;
}): { reason: string; kind: AiErrorKind } | null {
  const started = Date.parse(input.startedAt);
  const updated = Date.parse(input.updatedAt);
  if (Number.isNaN(started) || Number.isNaN(updated)) return null;

  if (input.now - started > input.budgetMs) {
    const minutes = Math.round(input.budgetMs / 60_000);
    return {
      reason:
        `Exceeded the ${minutes}-minute budget for a single run. It was stopped so the ` +
        "queue could keep moving — no post was created.",
      kind: "timeout",
    };
  }

  if (input.now - updated > input.stallMs) {
    const minutes = Math.round(input.stallMs / 60_000);
    return {
      reason:
        `No step completed for ${minutes} minutes, so the run was stopped rather than ` +
        "left holding the queue. The provider likely stopped responding mid-request.",
      kind: "timeout",
    };
  }

  return null;
}

/** Checks every in-flight run and stops the ones that are no longer moving. */
async function checkStalls(): Promise<void> {
  const current = state();
  const now = Date.now();
  const budgetMs = AI_ENV.jobBudgetMs;
  const stallMs = AI_ENV.stepStallMs;

  for (const jobId of [...current.running]) {
    const job = getJob(jobId);
    if (!job) {
      release(jobId);
      continue;
    }
    if (job.status !== "running") continue;

    const verdict = stallReason({
      startedAt: job.createdAt,
      updatedAt: job.updatedAt,
      now,
      budgetMs,
      stallMs,
    });
    if (!verdict) continue;

    await stopRun(jobId, verdict.reason, verdict.kind);
  }
}

/**
 * Stops a run: the job, the persisted run and its unfinished steps, together.
 *
 * All three have to agree, or the queue shows one story and the job another.
 */
async function stopRun(
  jobId: string,
  reason: string,
  kind: AiErrorKind,
): Promise<void> {
  const job = getJob(jobId);
  const runningStep = job?.steps.find((step) => step.status === "running") ?? null;

  await updateRun(jobId, (run) => ({
    ...run,
    status: "failed",
    failedStep: runningStep?.id ?? run.failedStep,
    failedStepLabel: runningStep?.label ?? run.failedStepLabel,
    error: reason,
    errorKind: kind,
    finishedAt: new Date().toISOString(),
    steps: run.steps.map((step) =>
      step.status === "running"
        ? { ...step, status: "failed", message: reason }
        : step,
    ),
  }));

  updateJob(jobId, {
    status: "failed",
    error: runningStep ? `${runningStep.label}: ${reason}` : reason,
    finishedAt: new Date().toISOString(),
  });

  release(jobId);
}

function ensureWatchdog(): void {
  const current = state();
  if (current.watchdog) return;

  const timer = setInterval(() => {
    void checkStalls().catch(() => undefined);
  }, 30_000);

  // Never a reason to keep a process alive.
  timer.unref?.();
  current.watchdog = timer;
}

/* -------------------------------------------------------------------------- */
/*  Reconciliation                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Closes out runs that this process is not running.
 *
 * A redeploy, a crash or a machine sleeping mid-run leaves a run persisted as
 * `running` with nothing behind it. The stall window is the safety margin: a run
 * being worked on elsewhere is touched every few seconds, so only genuinely
 * abandoned ones are reaped, and the reason says what actually happened.
 */
export async function reconcileRuns(): Promise<number> {
  const current = state();
  const runs = await listRuns(25);
  const now = Date.now();
  const stallMs = AI_ENV.stepStallMs;
  let reaped = 0;

  for (const run of runs) {
    if (run.status !== "running") continue;
    if (current.running.includes(run.jobId)) continue;

    const updated = Date.parse(run.finishedAt ?? run.startedAt);
    if (Number.isNaN(updated) || now - updated <= stallMs) continue;

    const stuck = run.steps.find((step) => step.status === "running");
    const reason =
      "The process running this stopped before it finished (server restart, " +
      "redeploy, or the machine slept). No post was created by it.";

    await updateRun(run.jobId, (entry) => ({
      ...entry,
      status: "failed" as const,
      failedStep: stuck?.step ?? entry.failedStep,
      failedStepLabel: stuck?.label ?? entry.failedStepLabel,
      error: reason,
      errorKind: "timeout" as const,
      finishedAt: new Date(now).toISOString(),
      steps: entry.steps.map((step) =>
        step.status === "running"
          ? { ...step, status: "failed", message: reason }
          : step.status === "pending"
            ? { ...step, status: "skipped", message: "Not reached — the run stopped earlier." }
            : step,
      ),
    }));

    reaped += 1;
  }

  return reaped;
}

/** Test seam: the in-flight/pending state, without reaching into globals. */
export function __schedulerStateForTests(): {
  running: string[];
  pending: string[];
} {
  const current = state();
  return {
    running: [...current.running],
    pending: current.pending.map((entry) => entry.jobId),
  };
}

/** Test seam: forget all in-flight state between cases. */
export function __resetSchedulerForTests(): void {
  const current = state();
  current.running = [];
  current.pending = [];
  current.inputs.clear();
}
