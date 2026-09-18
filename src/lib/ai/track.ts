import {
  finishRun,
  saveCheckpoint,
  startRun,
  updateRunStep,
  type FinishRunInput,
} from "@/lib/repositories/generation-runs-repository";
import type {
  AiErrorKind,
  AiStepId,
  BrandId,
  GenerationCheckpoint,
  GenerationRunRequest,
  GenerationRunStep,
} from "@/types";

import { AiError } from "./errors";
import { updateJob, updateStep } from "./jobs";

/**
 * The one place a generation run is reported.
 *
 * Two audiences need to know what the engine is doing, and before this existed
 * neither was told: the live job behind the progress dialog (never updated, so it
 * sat at zero steps while the pipeline ran) and the persisted run in the store
 * (never written, so a failure left no trace beyond a post that simply was not
 * there). A tracker records each step once and fans it out to both, which is why
 * the dialog and the queue cannot disagree about what happened.
 *
 * The shape of the API is the important part: a step is a function of its own
 * outcome. `step("research", async () => …)` marks the stage running, runs the
 * work, and records whatever the callback hands back — including the sentence a
 * reviewer reads, which is written where the result is known rather than
 * reconstructed later from logs. If the callback throws, the stage is stamped
 * failed, the run is closed out with the provider's own message, and the error
 * still propagates: recording a failure must not swallow it.
 */

/** What a step reports when it finishes. */
export interface StepOutcome<T> {
  value: T;
  /** One sentence describing what happened. Shown verbatim in the queue. */
  message: string;
  /**
   * `warning` for "succeeded, with a caveat" (facts without grounding), and
   * `skipped` for a stage a resumed run reused instead of re-running. The last one
   * matters: a reused stage did not call a model, and reporting it as a fresh
   * success would overstate what the attempt actually did.
   */
  status?: "success" | "warning" | "skipped";
  /** `provider · model`, when a model did the work. */
  model?: string | null;
  durationMs?: number | null;
  tokens?: number | null;
  attempts?: number | null;
}

/** A stage the pipeline did not exercise, with the reason why. */
export interface StepSkip {
  message: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

/** Run-step status to job-step status. `warning` is still a completed step. */
function jobStatus(
  status: GenerationRunStep["status"],
): "pending" | "running" | "success" | "failed" | "skipped" {
  switch (status) {
    case "pending":
      return "pending";
    case "running":
      return "running";
    case "failed":
      return "failed";
    case "skipped":
      return "skipped";
    default:
      return "success";
  }
}

/** The provider's own words, plus the classification the manager already made. */
function describeFailure(error: unknown): { message: string; kind: AiErrorKind } {
  if (error instanceof AiError) {
    return { message: error.message, kind: error.kind };
  }
  if (error instanceof Error) {
    return { message: error.message, kind: "unknown" };
  }
  return { message: String(error), kind: "unknown" };
}

export interface RunTracker {
  /** The persisted run, as it was when the pipeline started. */
  steps: GenerationRunStep[];
  /** Records a stage that was not needed, with the reason. */
  skip: (stage: AiStepId, outcome: StepSkip) => Promise<void>;
  /** Runs one stage, recording its outcome or its failure. */
  step: <T>(stage: AiStepId, task: () => Promise<StepOutcome<T>>) => Promise<T>;
  /**
   * Closes the run out as failed. Called for errors raised *between* stages —
   * a quality gate rejecting every candidate, say — where no step was running.
   */
  fail: (error: unknown) => Promise<void>;
  /** Closes the run out as succeeded, linking the post it produced. */
  succeed: (input: { postId: string; tokens: number }) => Promise<void>;
  /**
   * Persists the stage payloads produced so far.
   *
   * Called as each stage settles, not at the end of the run: the value of a
   * checkpoint is entirely in existing at the moment the run dies.
   */
  saveCheckpoint: (checkpoint: GenerationCheckpoint) => Promise<void>;
}

export async function createRunTracker(input: {
  jobId: string;
  brandId: BrandId;
  /** Payloads from an earlier attempt this run is continuing. */
  checkpoint?: GenerationCheckpoint | null;
  /** Tokens earlier attempts already spent, carried so totals stay honest. */
  tokensCarried?: number;
  /** The run being continued, when this is a retry. */
  resumedFrom?: string | null;
  /** The brief, stored so a retry can repeat it instead of guessing. */
  request?: GenerationRunRequest;
}): Promise<RunTracker> {
  const run = await startRun(input);
  await updateJob(input.jobId, { status: "running" });

  /** The stage currently in flight, so an out-of-band error can name it. */
  let current: GenerationRunStep | null = null;
  let provider: string | null = null;
  // Carried forward rather than reset: a resumed run's total is what the whole
  // job cost, not just its final attempt.
  let tokens = input.tokensCarried ?? 0;
  /**
   * Whether the run already has an outcome. A step that throws closes the run
   * out itself, and the caller's outer `catch` then reports the same error again
   * — without this the run would be rewritten, and a later failure could not
   * overwrite the real one.
   */
  let settled = false;

  /** The plan entry for a stage: first still-pending one, else the first. */
  function entryFor(stage: AiStepId): GenerationRunStep | undefined {
    return (
      run.steps.find((step) => step.step === stage && step.status === "pending") ??
      run.steps.find((step) => step.step === stage)
    );
  }

  /** Writes the step to both the persisted run and the live job. */
  async function record(
    entry: GenerationRunStep,
    patch: Partial<GenerationRunStep>,
  ): Promise<void> {
    Object.assign(entry, patch);
    await updateRunStep(input.jobId, entry.id, patch);
    await updateStep(input.jobId, entry.step, {
      status: jobStatus(entry.status),
      detail: entry.message,
      attempts: entry.attempts ?? 0,
    });
  }

  async function markRunning(entry: GenerationRunStep): Promise<void> {
    current = entry;
    await record(entry, { status: "running", startedAt: nowIso() });
  }

  async function finishStep(
    entry: GenerationRunStep,
    outcome: StepOutcome<unknown>,
  ): Promise<void> {
    if (outcome.model) provider = outcome.model;
    tokens += outcome.tokens ?? 0;

    await record(entry, {
      status: outcome.status ?? "success",
      message: outcome.message,
      model: outcome.model ?? null,
      durationMs: outcome.durationMs ?? null,
      tokens: outcome.tokens ?? null,
      attempts: outcome.attempts ?? null,
      finishedAt: nowIso(),
    });
    current = null;
  }

  async function closeOut(outcome: FinishRunInput): Promise<void> {
    if (settled) return;
    settled = true;
    await finishRun(input.jobId, outcome);
  }

  return {
    steps: run.steps,

    async skip(stage, outcome) {
      const entry = entryFor(stage);
      if (!entry) return;
      await record(entry, {
        status: "skipped",
        message: outcome.message,
        finishedAt: nowIso(),
      });
    },

    async step<T>(stage: AiStepId, task: () => Promise<StepOutcome<T>>): Promise<T> {
      const entry = entryFor(stage);
      if (!entry) {
        // Not in this run's plan: still run the work, just nothing to report.
        return (await task()).value;
      }

      await markRunning(entry);

      try {
        const outcome = await task();
        await finishStep(entry, outcome);
        return outcome.value;
      } catch (error) {
        const { message, kind } = describeFailure(error);

        await record(entry, {
          status: "failed",
          message,
          finishedAt: nowIso(),
        });
        current = entry;
        await closeOut({
          status: "failed",
          failedStep: entry.step,
          failedStepLabel: entry.label,
          error: message,
          errorKind: kind,
          provider,
          tokens,
        });
        await updateJob(input.jobId, {
          status: "failed",
          error: `${entry.label}: ${message}`,
          finishedAt: nowIso(),
        });

        throw error;
      }
    },

    async fail(error) {
      const { message, kind } = describeFailure(error);
      const entry = current;

      if (entry && entry.status !== "failed") {
        await record(entry, { status: "failed", message, finishedAt: nowIso() });
      }

      await closeOut({
        status: "failed",
        failedStep: entry?.step ?? null,
        failedStepLabel: entry?.label ?? null,
        error: message,
        errorKind: kind,
        provider,
        tokens,
      });
      await updateJob(input.jobId, {
        status: "failed",
        error: entry ? `${entry.label}: ${message}` : message,
        finishedAt: nowIso(),
      });
    },

    async succeed({ postId, tokens: totalTokens }) {
      await closeOut({
        status: "succeeded",
        postId,
        provider,
        tokens: totalTokens,
      });
      await updateJob(input.jobId, {
        status: "succeeded",
        postId,
        finishedAt: nowIso(),
      });
    },

    async saveCheckpoint(checkpoint) {
      await saveCheckpoint(input.jobId, checkpoint);
    },
  };
}
