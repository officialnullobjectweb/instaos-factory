import type { GenerationLogEntry, GenerationRun } from "@/types";

/**
 * The generation pipeline as one list, whatever it came from.
 *
 * Two records describe a run and they are not the same shape: a persisted run
 * carries the full plan (including stages that were folded into others), the
 * provider attempts behind each step, and the failure that stopped it before a
 * post existed; a post's own log is what the engine wrote alongside the content
 * and is all that exists for anything generated before runs were recorded.
 *
 * Normalising them here — in `lib`, with no React — keeps the rule "prefer the
 * run, fall back to the log" in one place, and makes it testable without
 * rendering anything.
 */

export type TimelineStepStatus =
  | "pending"
  | "running"
  | "success"
  | "warning"
  | "skipped"
  | "failed";

export interface TimelineStep {
  id: string;
  label: string;
  status: TimelineStepStatus;
  message: string | null;
  model: string | null;
  durationMs: number | null;
  tokens: number | null;
  attempts: number | null;
  at: string | null;
}

/** Post-log stage names. `brief` is the older name for the topic stage. */
const LOG_STEP_LABELS: Record<GenerationLogEntry["step"], string> = {
  topic: "Pick topic",
  brief: "Pick topic",
  research: "Research topic",
  verify: "Verify facts",
  carousel: "Generate carousel JSON",
  design: "Select design",
  caption: "Generate caption",
  hashtags: "Generate hashtags",
  alt_text: "Generate alt text",
  quality: "Score quality",
  schedule: "Pick publishing slot",
};

/** A run's plan, as it stands right now — every step, in pipeline order. */
export function stepsFromRun(run: GenerationRun): TimelineStep[] {
  return run.steps.map((step) => ({
    id: step.id,
    label: step.label,
    status: step.status,
    message: step.message,
    model: step.model,
    durationMs: step.durationMs,
    tokens: step.tokens,
    attempts: step.attempts,
    at: step.finishedAt ?? step.startedAt,
  }));
}

/** A post's own log, oldest first. */
export function stepsFromLogs(logs: GenerationLogEntry[]): TimelineStep[] {
  return [...logs]
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .map((entry, index) => ({
      id: entry.id || `step-${index}`,
      label: LOG_STEP_LABELS[entry.step] ?? entry.step,
      // The post log calls a failure `error`; the timeline calls it `failed`.
      status: entry.status === "error" ? "failed" : entry.status,
      message: entry.message,
      model: entry.model,
      durationMs: entry.durationMs,
      tokens: entry.tokens,
      attempts: null,
      at: entry.timestamp,
    }));
}

/**
 * The steps for a post: its run when one is on record, otherwise its own log.
 *
 * The run wins because it is the more complete record — it includes stages the
 * pipeline folded into others and the failure reason for a run that produced no
 * post at all. The log is the fallback for older posts, not a second opinion.
 */
export function stepsForPost(
  run: GenerationRun | null | undefined,
  logs: GenerationLogEntry[],
): TimelineStep[] {
  return run ? stepsFromRun(run) : stepsFromLogs(logs);
}

export interface StepTotals {
  settled: number;
  total: number;
  computeMs: number;
  tokens: number;
  /** True when the pipeline stopped part-way through. */
  stopped: boolean;
}

export function summariseSteps(steps: TimelineStep[]): StepTotals {
  let settled = 0;
  let computeMs = 0;
  let tokens = 0;

  for (const step of steps) {
    if (step.status !== "pending" && step.status !== "running") settled += 1;
    computeMs += step.durationMs ?? 0;
    tokens += step.tokens ?? 0;
  }

  return {
    settled,
    total: steps.length,
    computeMs,
    tokens,
    stopped: steps.some((step) => step.status === "failed"),
  };
}
