"use client";

import { CircleAlert, CircleCheck, CircleDashed, LoaderCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { AiJob, AiStepStatus } from "@/types";

const STEP_META: Record<AiStepStatus, { icon: LucideIcon; className: string }> = {
  pending: { icon: CircleDashed, className: "text-ink-3" },
  running: { icon: LoaderCircle, className: "animate-spin text-ink" },
  success: { icon: CircleCheck, className: "text-success" },
  failed: { icon: CircleAlert, className: "text-danger" },
  skipped: { icon: CircleDashed, className: "text-ink-3" },
};

/**
 * The eight steps, live.
 *
 * `skipped` is a first-class outcome rather than a hidden one: when the engine
 * runs in composed mode four of these steps happen inside the carousel call, and
 * saying so is more honest than showing an empty row or a fake spinner.
 */
export function GenerationProgress({ job }: { job: AiJob }) {
  const settled = job.steps.filter(
    (step) => step.status === "success" || step.status === "failed" || step.status === "skipped",
  ).length;

  const percent = Math.round((settled / job.steps.length) * 100);
  const active = job.steps.find((step) => step.status === "running");
  const waiting = job.status === "queued";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3 text-[12.5px]">
          <span className="font-medium text-ink">
            {waiting
              ? `Waiting for a free slot${job.queuePosition ? ` — position ${job.queuePosition}` : ""}`
              : (active?.label ?? "Finishing up")}
          </span>
          <span className="text-ink-3 tnum">
            {settled}/{job.steps.length} steps
          </span>
        </div>
        <Progress value={percent} aria-label={`Generation ${percent}% complete`} />
        {waiting ? (
          <span className="text-[11.5px] leading-relaxed text-ink-3">
            Runs queue instead of starting together, so every provider keeps a
            healthy request rate. This one starts on its own as soon as a slot frees up.
          </span>
        ) : null}
      </div>

      <ol className="flex flex-col divide-y divide-line">
        {job.steps.map((step) => {
          const meta = STEP_META[step.status];
          const Icon = meta.icon;

          return (
            <li key={step.id} className="flex items-start gap-2.5 py-2.5">
              <Icon
                className={cn("mt-0.5 size-3.5 shrink-0", meta.className)}
                aria-hidden="true"
              />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span
                  className={cn(
                    "text-[12.5px]",
                    step.status === "pending" ? "text-ink-3" : "text-ink",
                  )}
                >
                  {step.label}
                </span>
                {step.detail ? (
                  <span className="text-[11.5px] leading-relaxed text-ink-2">
                    {step.detail}
                  </span>
                ) : null}
              </span>
              {step.attempts > 1 ? (
                <span className="shrink-0 text-[11px] text-ink-3 tnum">
                  {step.attempts} attempts
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
