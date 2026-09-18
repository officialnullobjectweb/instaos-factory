"use client";

import {
  CircleCheck,
  CircleDashed,
  CircleDot,
  CircleSlash,
  FileClock,
  LoaderCircle,
  TriangleAlert,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
import { Badge } from "@/components/ui/badge";
import { formatDateTime, formatTime } from "@/lib/format";
import {
  stepsForPost,
  stepsFromRun,
  summariseSteps,
  type TimelineStep,
  type TimelineStepStatus,
} from "@/lib/queue/generation-steps";
import { cn } from "@/lib/utils";
import type { GenerationLogEntry, GenerationRun } from "@/types";

/**
 * The generation pipeline, step by step.
 *
 * The mapping from a run's record (or a post's log) to a uniform step list lives
 * in `lib/queue/generation-steps.ts`, where it is testable without a renderer.
 * What stays here is presentation: which icon a status earns, and how the failure
 * is worded.
 */

const STATUS_META: Record<
  TimelineStepStatus,
  { icon: LucideIcon; className: string; label: string }
> = {
  pending: { icon: CircleDashed, className: "text-ink-3", label: "Waiting" },
  running: { icon: LoaderCircle, className: "animate-spin text-ink", label: "Running" },
  success: { icon: CircleCheck, className: "text-success", label: "Done" },
  warning: { icon: CircleDot, className: "text-warning", label: "Done with caveats" },
  skipped: { icon: CircleSlash, className: "text-ink-3", label: "Not run" },
  failed: { icon: TriangleAlert, className: "text-danger", label: "Failed" },
};

export interface StepTimelineProps {
  steps: TimelineStep[];
  className?: string;
  /** Compact drops the per-step message to a single clamped line. */
  density?: "comfortable" | "compact";
}

/** The ordered steps. Never collapses a failure into a tick. */
export function StepTimeline({
  steps,
  className,
  density = "comfortable",
}: StepTimelineProps) {
  const compact = density === "compact";

  return (
    <ol className={cn("flex flex-col", className)}>
      {steps.map((step, index) => {
        const meta = STATUS_META[step.status];
        const Icon = meta.icon;
        const muted = step.status === "pending" || step.status === "skipped";

        return (
          <li key={step.id} className="flex gap-3">
            <span className="flex flex-col items-center pt-0.5">
              <Icon
                className={cn("size-3.5 shrink-0", meta.className)}
                aria-hidden="true"
              />
              {index < steps.length - 1 ? (
                <span aria-hidden="true" className="mt-1 w-px flex-1 bg-line" />
              ) : null}
            </span>

            <span
              className={cn(
                "flex min-w-0 flex-1 flex-col gap-1",
                compact ? "pb-2.5" : "pb-4",
              )}
            >
              <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span
                  className={cn(
                    "text-[13px] font-medium",
                    muted ? "text-ink-3" : "text-ink",
                  )}
                >
                  {step.label}
                </span>
                <span className="sr-only">{meta.label}</span>
                {step.at ? (
                  <span className="text-[11px] text-ink-3 tnum">
                    {formatTime(step.at)}
                  </span>
                ) : null}
                {step.durationMs !== null && step.durationMs > 0 ? (
                  <span className="text-[11px] text-ink-3 tnum">
                    {(step.durationMs / 1000).toFixed(1)}s
                  </span>
                ) : null}
                {step.tokens !== null && step.tokens > 0 ? (
                  <span className="text-[11px] text-ink-3 tnum">
                    {step.tokens.toLocaleString("en-US")} tokens
                  </span>
                ) : null}
                {step.attempts !== null && step.attempts > 1 ? (
                  <Badge tone="warning" size="sm">
                    {step.attempts} attempts
                  </Badge>
                ) : null}
              </span>

              {step.message ? (
                <p
                  className={cn(
                    "text-[12.5px] leading-relaxed",
                    step.status === "failed" ? "text-danger" : "text-ink-2",
                    compact && "line-clamp-2",
                  )}
                >
                  {step.message}
                </p>
              ) : step.status === "pending" ? (
                <p className="text-[12.5px] text-ink-3">Not started yet.</p>
              ) : null}

              {step.model ? (
                <span className="font-mono text-[10.5px] text-ink-3">
                  {step.model}
                </span>
              ) : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Steps done, compute time and tokens for a set of steps. */
export function StepSummary({
  steps,
  provider,
  className,
}: {
  steps: TimelineStep[];
  provider?: string | null;
  className?: string;
}) {
  const stats = summariseSteps(steps);

  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-3 rounded-lg border border-line bg-surface-2 p-3 sm:grid-cols-4",
        className,
      )}
    >
      {[
        { label: "Steps", value: `${stats.settled}/${stats.total}` },
        { label: "Compute", value: `${(stats.computeMs / 1000).toFixed(1)}s` },
        { label: "Tokens", value: stats.tokens.toLocaleString("en-US") },
        { label: "Model", value: provider ? provider.split(" · ")[0] : "—" },
      ].map((stat) => (
        <div key={stat.label} className="flex flex-col gap-0.5">
          <span className="text-[11px] tracking-[0.06em] text-ink-3 uppercase">
            {stat.label}
          </span>
          <span className="truncate text-[14px] font-medium text-ink tnum">
            {stat.value}
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * The reason a run stopped, stated as plainly as the provider put it.
 *
 * The step is named because "generation failed" is not actionable: knowing it was
 * the research call, or the topic gate, is what tells you whether to retry now or
 * change something first.
 */
export function RunFailureNotice({ run }: { run: GenerationRun }) {
  if (run.status !== "failed") return null;

  return (
    <div
      role="alert"
      className="flex flex-col gap-1.5 rounded-lg border border-danger/25 bg-danger-soft p-3.5"
    >
      <span className="flex flex-wrap items-center gap-2">
        <TriangleAlert className="size-4 shrink-0 text-danger" aria-hidden="true" />
        <span className="text-[12.5px] font-medium text-danger">
          Stopped at {run.failedStepLabel ?? "the run"}
        </span>
        {run.errorKind ? (
          <Badge tone="danger" size="sm">
            {run.errorKind.replace(/_/g, " ")}
          </Badge>
        ) : null}
        {run.finishedAt ? (
          <span className="text-[11px] text-ink-3 tnum">
            {formatDateTime(run.finishedAt)}
          </span>
        ) : null}
      </span>
      <span className="text-[12.5px] leading-relaxed text-ink-2">
        {run.error ?? "The engine did not report a reason — see the AI log for the raw response."}
      </span>
      <span className="text-[11.5px] text-ink-3">
        No post was created by this run. Every step it did complete is listed below.
      </span>
    </div>
  );
}

export interface GenerationStepsProps {
  /** The persisted run, when there is one. */
  run?: GenerationRun | null;
  /** The post's own log, used when no run was recorded. */
  logs?: GenerationLogEntry[];
  density?: "comfortable" | "compact";
  className?: string;
}

/** Everything the engine did, from one source or the other. */
export function GenerationSteps({
  run,
  logs,
  density = "comfortable",
  className,
}: GenerationStepsProps) {
  const steps = stepsForPost(run, logs ?? []);

  if (steps.length === 0) {
    return (
      <EmptyState
        icon={FileClock}
        size="sm"
        title="No generation log"
        description="This post predates run tracking, so there are no steps to inspect."
      />
    );
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {run ? <RunFailureNotice run={run} /> : null}
      <StepSummary steps={steps} provider={run?.provider ?? null} />
      <StepTimeline steps={steps} density={density} />
    </div>
  );
}
