import { randomUUID } from "node:crypto";

import { PIPELINE_STEPS, STEP_LABELS } from "@/lib/ai/jobs";
import { arrayDocument } from "@/lib/storage";
import type {
  AiStepId,
  BrandId,
  GenerationCheckpoint,
  GenerationRun,
  GenerationRunRequest,
  GenerationRunStatus,
  GenerationRunStep,
} from "@/types";

/**
 * Every generation attempt, successful or not.
 *
 * The in-memory job registry answers "is it running right now?"; this document
 * answers "what happened?" — including for runs that never produced a post. That
 * is the case worth persisting: a failure used to leave nothing behind except a
 * log entry, so the queue looked as though nothing had been attempted.
 *
 * Runs are newest-first and capped, and each one starts as the full pipeline plan
 * with every step `pending`, so the UI can show what is about to happen and then
 * fill it in rather than revealing steps as they appear.
 */

const MAX_RUNS = 40;

/**
 * Guards runs read back from the store.
 *
 * These documents are served from a store a human can edit, and a malformed run
 * would crash the panel that lists failures — the one place a broken run must
 * still be readable.
 */
function isGenerationRun(raw: unknown): raw is GenerationRun {
  if (typeof raw !== "object" || raw === null) return false;
  const run = raw as Partial<GenerationRun>;

  return (
    typeof run.id === "string" &&
    typeof run.jobId === "string" &&
    typeof run.brandId === "string" &&
    typeof run.status === "string" &&
    typeof run.startedAt === "string" &&
    Array.isArray(run.steps)
  );
}

const runs = () =>
  arrayDocument<GenerationRun>({
    key: "generation-runs",
    isItem: isGenerationRun,
    maxItems: MAX_RUNS,
  });

/**
 * Fills in fields added after a run was written.
 *
 * The store is long-lived and outlives any single version of this schema: a run
 * saved before checkpoints existed has no `request` and no `checkpoint`, and the
 * failures panel reads both. Defaulting on read keeps every stored run renderable
 * instead of making an old row crash the surface that explains failures.
 */
function withDefaults(run: GenerationRun): GenerationRun {
  return {
    ...run,
    request: run.request ?? { steer: null, owner: null },
    checkpoint: run.checkpoint ?? null,
    resumedFrom: run.resumedFrom ?? null,
  };
}

/** The one read path, so every caller sees normalised runs. */
async function readRuns(): Promise<GenerationRun[]> {
  return (await runs().read()).map(withDefaults);
}

/** The plan every run starts from: all stages, all pending. */
export function plannedSteps(): GenerationRunStep[] {
  return PIPELINE_STEPS.map((step, index) => ({
    id: `step-${index + 1}-${step}`,
    step,
    label: STEP_LABELS[step],
    status: "pending",
    message: null,
    model: null,
    durationMs: null,
    tokens: null,
    attempts: null,
    startedAt: null,
    finishedAt: null,
  }));
}

export interface StartRunInput {
  jobId: string;
  brandId: BrandId;
  /** The brief, stored so a retry can repeat it exactly. */
  request?: GenerationRunRequest;
  /**
   * Payloads carried over from an earlier attempt.
   *
   * A resumed run starts life holding them, so the first thing it does is skip
   * the stages that already succeeded — and if it dies again, the checkpoint it
   * leaves behind is the union of what both attempts produced.
   */
  checkpoint?: GenerationCheckpoint | null;
  /** Tokens already spent by earlier attempts, so the total stays truthful. */
  tokensCarried?: number;
  /** The run this one continues. */
  resumedFrom?: string | null;
}

/** Records a run the moment it starts, so a crash mid-run still leaves a trace. */
export async function startRun(input: StartRunInput): Promise<GenerationRun> {
  const run: GenerationRun = {
    id: `run-${randomUUID().slice(0, 12)}`,
    jobId: input.jobId,
    brandId: input.brandId,
    request: input.request ?? { steer: null, owner: null },
    status: "running",
    postId: null,
    provider: null,
    tokens: input.tokensCarried ?? 0,
    failedStep: null,
    failedStepLabel: null,
    error: null,
    errorKind: null,
    resumedFrom: input.resumedFrom ?? null,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    steps: plannedSteps(),
    checkpoint: input.checkpoint ?? null,
  };

  await runs().prepend(run);
  return run;
}

/**
 * Stores a stage's payload as it completes.
 *
 * Written the moment the stage settles rather than at the end of the run: the
 * whole point is to survive a failure, and a checkpoint written after the last
 * step would only ever exist for runs that did not need it.
 */
export async function saveCheckpoint(
  jobId: string,
  checkpoint: GenerationCheckpoint,
): Promise<void> {
  await updateRun(jobId, (run) => ({ ...run, checkpoint }));
}

/**
 * Applies a patch to the run for `jobId`.
 *
 * The mutator is pure with respect to the stored run (the document layer may
 * re-apply it), and unknown job ids are a no-op rather than an error: a run that
 * was trimmed by the cap while still in flight must not break generation.
 */
export async function updateRun(
  jobId: string,
  patch: (run: GenerationRun) => GenerationRun,
): Promise<GenerationRun | null> {
  let updated: GenerationRun | null = null;

  await runs().mutate((current) => {
    let found = false;
    const next = current.map((run) => {
      if (run.jobId !== jobId) return run;
      found = true;
      return patch(run);
    });

    return found ? next : current;
  });

  updated = (await readRuns()).find((run) => run.jobId === jobId) ?? null;
  return updated;
}

/** Replaces one step within the run for `jobId`. */
export async function updateRunStep(
  jobId: string,
  stepId: string,
  patch: Partial<GenerationRunStep>,
): Promise<void> {
  await updateRun(jobId, (run) => ({
    ...run,
    steps: run.steps.map((step) =>
      step.id === stepId ? { ...step, ...patch } : step,
    ),
  }));
}

export interface FinishRunInput {
  status: GenerationRunStatus;
  postId?: string | null;
  provider?: string | null;
  tokens?: number;
  failedStep?: AiStepId | null;
  failedStepLabel?: string | null;
  error?: string | null;
  errorKind?: GenerationRun["errorKind"];
}

/** Closes a run out. Called on both paths — success and failure. */
export async function finishRun(
  jobId: string,
  input: FinishRunInput,
): Promise<void> {
  await updateRun(jobId, (run) => ({
    ...run,
    status: input.status,
    postId: input.postId ?? run.postId,
    provider: input.provider ?? run.provider,
    tokens: input.tokens ?? run.tokens,
    failedStep: input.failedStep ?? run.failedStep,
    failedStepLabel: input.failedStepLabel ?? run.failedStepLabel,
    error: input.error ?? run.error,
    errorKind: input.errorKind ?? run.errorKind,
    finishedAt: new Date().toISOString(),
  }));
}

/** Newest first. */
export async function listRuns(limit?: number): Promise<GenerationRun[]> {
  const all = await readRuns();
  return limit ? all.slice(0, limit) : all;
}

/** One run by its own id, for the resume path. */
export async function getRun(runId: string): Promise<GenerationRun | null> {
  return (await readRuns()).find((run) => run.id === runId) ?? null;
}

/** The run behind a job, so a failed job can offer to continue rather than repeat. */
export async function findRunByJob(jobId: string): Promise<GenerationRun | null> {
  return (await readRuns()).find((run) => run.jobId === jobId) ?? null;
}

/** The run for one post, when it has one. */
export async function findRunByPost(postId: string): Promise<GenerationRun | null> {
  return (await readRuns()).find((run) => run.postId === postId) ?? null;
}
