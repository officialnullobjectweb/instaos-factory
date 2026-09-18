"use client";

import {
  Activity,
  CircleAlert,
  CircleCheck,
  LoaderCircle,
  RefreshCw,
  RotateCcw,
} from "lucide-react";
import { useId, useState } from "react";

import { EmptyState } from "@/components/feedback/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Disclosure, DisclosureButton } from "@/components/ui/disclosure";
import { getBrand } from "@/data/brands";
import { GenerationSteps } from "@/features/queue/components/generation-steps";
import { useGenerationRuns } from "@/hooks/use-generation-runs";
import { canResume, resumeSummary } from "@/lib/ai/checkpoint";
import { aiApi } from "@/lib/api/ai-client";
import { formatRelativeTime } from "@/lib/format";
import { MOCK_NOW } from "@/data/time";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type { GenerationRun } from "@/types";

/**
 * What the generation engine has attempted, including what failed.
 *
 * The queue lists posts, which is exactly the wrong place to look for a run that
 * produced none: before this panel, a generation that died at the research step
 * left the queue unchanged, so it was indistinguishable from not having pressed
 * the button. Failures lead the list, then in-flight runs, then recent successes,
 * and every row expands into the same step timeline a post shows — so the answer
 * to "why is there no post?" is one click from the queue rather than buried in a
 * server log.
 */
export function GenerationRuns({ className }: { className?: string }) {
  const { runs, active, failed, loading, error, refresh } = useGenerationRuns();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [resuming, setResuming] = useState<string | null>(null);
  const baseId = useId();

  /**
   * Continues a failed run from its checkpoint.
   *
   * Deliberately available right here, next to the failure: the moment someone
   * reads why a run stopped is the moment they decide whether to continue it, and
   * the alternative — starting over — re-spends every token the first attempt
   * already paid for.
   */
  async function handleResume(run: GenerationRun) {
    setResuming(run.id);
    try {
      const accepted = await aiApi.resume(run.id);

      toast.success("Run resumed", {
        description: accepted.queued
          ? `Waiting for a free slot${accepted.position ? ` — position ${accepted.position}` : ""}. Finished steps are kept.`
          : "Continuing from the step that failed. Finished steps are kept.",
      });

      await refresh();
    } catch (cause) {
      toast.error("Could not resume the run", {
        description: cause instanceof Error ? cause.message : "Unknown error",
      });
    } finally {
      setResuming(null);
    }
  }

  if (loading && runs.length === 0) return null;

  if (error && runs.length === 0) {
    return (
      <Card className={cn("gap-0 p-0", className)}>
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <span className="flex items-center gap-2 text-[12.5px] text-danger">
            <CircleAlert className="size-3.5 shrink-0" aria-hidden="true" />
            {error}
          </span>
          <Button size="xs" variant="ghost" onClick={() => void refresh()}>
            <RefreshCw />
            Retry
          </Button>
        </div>
      </Card>
    );
  }

  if (runs.length === 0) return null;

  const ordered = [
    ...runs.filter((run) => run.status === "failed"),
    ...runs.filter((run) => run.status === "running"),
    ...runs.filter((run) => run.status === "succeeded"),
  ].slice(0, 6);

  return (
    <Card className={cn("gap-0 overflow-hidden p-0", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div className="flex flex-col gap-0.5">
          <span className="flex items-center gap-2 text-[13px] font-medium text-ink">
            <Activity className="size-3.5 text-ink-3" aria-hidden="true" />
            Generation runs
          </span>
          <span className="text-[11.5px] text-ink-3">
            {failed.length > 0
              ? `${failed.length} failed run${failed.length === 1 ? "" : "s"} — expand one to see the step it stopped at.`
              : active
                ? "A run is in flight. Steps update as each one settles."
                : "Every attempt the engine made, newest first."}
          </span>
        </div>

        <span className="flex items-center gap-2">
          {failed.length > 0 ? (
            <Badge tone="danger" size="sm">
              {failed.length} failed
            </Badge>
          ) : null}
          {active ? (
            <Badge tone="neutral" size="sm">
              <LoaderCircle className="size-3 animate-spin" />
              running
            </Badge>
          ) : null}
          <Button
            size="xs"
            variant="ghost"
            aria-label="Refresh generation runs"
            onClick={() => void refresh()}
          >
            <RefreshCw />
            Refresh
          </Button>
        </span>
      </div>

      <ul className="divide-y divide-line">
        {ordered.map((run) => {
          const id = `${baseId}-${run.id}`;
          const open = expanded === run.id;
          const brand = getBrand(run.brandId);

          return (
            <li key={run.id}>
              <div
                className={cn(
                  "flex items-center gap-3 px-4 py-3",
                  run.status === "failed" && "bg-danger-soft/40",
                )}
              >
                <RunStatusIcon run={run} />

                <button
                  type="button"
                  onClick={() => setExpanded(open ? null : run.id)}
                  aria-expanded={open}
                  aria-controls={id}
                  className="flex min-w-0 flex-1 flex-col gap-0.5 rounded-sm text-left outline-none"
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-[13px] font-medium text-ink">
                      {brand.name}
                    </span>
                    {run.status === "failed" ? (
                      <Badge tone="danger" size="sm">
                        stopped at {run.failedStepLabel ?? "an unknown step"}
                      </Badge>
                    ) : run.status === "running" ? (
                      <Badge tone="neutral" size="sm">
                        in progress
                      </Badge>
                    ) : run.postId ? (
                      <Badge tone="success-outline" size="sm">
                        {run.postId}
                      </Badge>
                    ) : null}
                  </span>
                  <span className="truncate text-[11.5px] text-ink-3">
                    {run.status === "failed"
                      ? run.error
                      : run.status === "running"
                        ? "Writing the post — expand for live steps."
                        : `Finished after ${run.steps.filter((step) => step.status === "success" || step.status === "warning").length} steps.`}
                  </span>
                </button>

                {run.status === "failed" && canResume(run) ? (
                  <Button
                    size="xs"
                    variant="secondary"
                    disabled={resuming === run.id}
                    onClick={() => void handleResume(run)}
                    title={resumeSummary(run)}
                  >
                    {resuming === run.id ? (
                      <LoaderCircle className="animate-spin" />
                    ) : (
                      <RotateCcw />
                    )}
                    Resume
                  </Button>
                ) : null}

                <span className="hidden shrink-0 text-[11.5px] text-ink-3 tnum sm:block">
                  {formatRelativeTime(run.startedAt, MOCK_NOW)}
                </span>

                <DisclosureButton
                  open={open}
                  onToggle={() => setExpanded(open ? null : run.id)}
                  label={`${open ? "Hide" : "Show"} generation steps for ${brand.name}`}
                  controls={id}
                />
              </div>

              <Disclosure open={open} id={id} className="border-t border-line bg-surface-2/40">
                <div className="flex flex-col gap-3 px-4 py-4">
                  <GenerationSteps run={run} density="compact" />

                  {run.status === "failed" && canResume(run) ? (
                    <p className="border-t border-line pt-3 text-[11.5px] leading-relaxed text-ink-3">
                      {resumeSummary(run)}
                    </p>
                  ) : null}
                </div>
              </Disclosure>
            </li>
          );
        })}
      </ul>

      {ordered.length === 0 ? (
        <EmptyState
          icon={CircleCheck}
          size="sm"
          title="Nothing has run yet"
          description="Press Generate post and the steps appear here as they happen."
        />
      ) : null}
    </Card>
  );
}

function RunStatusIcon({ run }: { run: GenerationRun }) {
  if (run.status === "failed") {
    return (
      <CircleAlert className="size-4 shrink-0 text-danger" aria-hidden="true" />
    );
  }
  if (run.status === "running") {
    return (
      <LoaderCircle
        className="size-4 shrink-0 animate-spin text-ink-2"
        aria-hidden="true"
      />
    );
  }
  return <CircleCheck className="size-4 shrink-0 text-success" aria-hidden="true" />;
}
