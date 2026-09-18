import type { ZodType } from "zod";

import type { AiStepId, GenerationCheckpoint, GenerationRun } from "@/types";

/**
 * Checkpointing: what a run keeps, and what a retry is allowed to reuse.
 *
 * A run is nine sequential model calls, and the expensive ones come first —
 * topic scoring and research carry the largest prompts in the pipeline. When a
 * run dies at the caption step, repeating the two minutes of research that
 * already produced twelve sourced facts is pure waste: it costs the same tokens
 * again, it can return something different, and it can fail again for reasons
 * that have nothing to do with what broke.
 *
 * So every stage that finishes successfully writes its validated payload here,
 * and a retry starts from the first stage without one. Two rules keep that safe:
 *
 *   - Only schema-validated payloads are stored, so the checkpoint cannot hold
 *     half a stage's output.
 *   - Payloads are re-validated on read. A checkpoint that no longer satisfies its
 *     schema is discarded and the stage is re-run deliberately, because feeding a
 *     stale payload back into the pipeline would produce a post no stage verified.
 */

/** Stages whose output is worth keeping: expensive to produce, cheap to store. */
export const CHECKPOINT_STEPS: readonly AiStepId[] = [
  "topic",
  "research",
  "carousel",
  "design",
  "quality",
  "hashtags",
  "caption",
] as const;

export function emptyCheckpoint(): GenerationCheckpoint {
  return { completed: [], artifacts: {}, savedAt: new Date().toISOString() };
}

/** Immutably adds a stage's payload, leaving the previous checkpoint untouched. */
export function withArtifact(
  checkpoint: GenerationCheckpoint,
  step: AiStepId,
  artifact: unknown,
): GenerationCheckpoint {
  return {
    completed: checkpoint.completed.includes(step)
      ? checkpoint.completed
      : [...checkpoint.completed, step],
    artifacts: { ...checkpoint.artifacts, [step]: artifact },
    savedAt: new Date().toISOString(),
  };
}

/**
 * The stored payload for a stage, when it is still valid.
 *
 * Returns `null` for "no usable checkpoint" — absent, malformed, or no longer
 * matching its schema — and the caller re-runs the stage. That is the only
 * correct response to an unusable payload: quietly trusting it would skip a stage
 * that never actually ran in this attempt.
 */
export function readArtifact<T>(
  checkpoint: GenerationCheckpoint | null | undefined,
  step: AiStepId,
  schema: ZodType<T>,
): T | null {
  const raw = checkpoint?.artifacts?.[step];
  if (raw === undefined || raw === null) return null;

  const parsed = schema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/** Payloads carried into a retry, or an empty checkpoint when there is nothing. */
export function resumeCheckpoint(run: GenerationRun | null): GenerationCheckpoint {
  const checkpoint = run?.checkpoint ?? null;
  if (!checkpoint || typeof checkpoint.artifacts !== "object" || !checkpoint.artifacts) {
    return emptyCheckpoint();
  }
  return checkpoint;
}

/**
 * Whether a run can be continued rather than repeated.
 *
 * Failed runs with at least one stored payload, and only those: a run that failed
 * on its very first stage has nothing to reuse, so offering "resume" would be a
 * button that spends the whole budget again under a different name.
 */
export function canResume(run: GenerationRun): boolean {
  if (run.status !== "failed") return false;
  const completed = run.checkpoint?.completed ?? [];
  return completed.length > 0;
}

/**
 * Stages a retry will not call a model for.
 *
 * Used for the sentence the operator reads before pressing resume, so the saving
 * is stated in advance rather than discovered afterwards in the run report.
 */
export function reusableSteps(run: GenerationRun): AiStepId[] {
  const completed = run.checkpoint?.completed ?? [];
  return CHECKPOINT_STEPS.filter((step) => completed.includes(step));
}

/** Stages a retry still has to run: everything not already checkpointed. */
export function pendingSteps(run: GenerationRun): AiStepId[] {
  const completed = run.checkpoint?.completed ?? [];
  return CHECKPOINT_STEPS.filter((step) => !completed.includes(step));
}

/** A one-line summary of what a retry would spend, for the confirmation dialog. */
export function resumeSummary(run: GenerationRun): string {
  const reuse = reusableSteps(run);
  const pending = pendingSteps(run);

  if (reuse.length === 0) {
    return "Nothing to reuse — this would run the whole pipeline again.";
  }

  return (
    `Reuses ${reuse.length} finished step${reuse.length === 1 ? "" : "s"} ` +
    `(${reuse.join(", ")}) with no model calls, and runs ` +
    `${pending.length} remaining step${pending.length === 1 ? "" : "s"}.`
  );
}
