import {
  CircleCheck,
  CircleDot,
  FileClock,
  LoaderCircle,
  TriangleAlert,
} from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
import { formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { GenerationLogEntry, GenerationLogStatus } from "@/types";

const STATUS_META: Record<
  GenerationLogStatus,
  { icon: typeof CircleCheck; className: string; label: string }
> = {
  success: { icon: CircleCheck, className: "text-success", label: "Success" },
  warning: { icon: CircleDot, className: "text-warning", label: "Warning" },
  error: { icon: TriangleAlert, className: "text-danger", label: "Error" },
  running: { icon: LoaderCircle, className: "text-ink-2", label: "Running" },
};

const STEP_LABELS: Record<GenerationLogEntry["step"], string> = {
  brief: "Brief intake",
  research: "Research pass",
  verify: "Fact check",
  caption: "Caption",
  carousel: "Carousel",
  hashtags: "Hashtags",
  alt_text: "Alt text",
  quality: "Quality check",
  schedule: "Slot picking",
};

interface GenerationLogProps {
  logs: GenerationLogEntry[];
  className?: string;
}

/** Newest first: the last thing the engine did is what a reviewer is checking. */
export function GenerationLog({ logs, className }: GenerationLogProps) {
  if (logs.length === 0) {
    return (
      <EmptyState
        icon={FileClock}
        size="sm"
        title="No generation log"
        description="This post predates logging, so there is no run to inspect."
      />
    );
  }

  const ordered = [...logs].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  const totalMs = logs.reduce((sum, entry) => sum + entry.durationMs, 0);
  const totalTokens = logs.reduce((sum, entry) => sum + entry.tokens, 0);

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="grid grid-cols-3 gap-2 rounded-lg border border-line bg-surface-2 p-3">
        {[
          { label: "Steps", value: String(logs.length) },
          { label: "Compute", value: `${(totalMs / 1000).toFixed(1)}s` },
          { label: "Tokens", value: totalTokens.toLocaleString("en-US") },
        ].map((stat) => (
          <div key={stat.label} className="flex flex-col gap-0.5">
            <span className="text-[11px] tracking-[0.06em] text-ink-3 uppercase">
              {stat.label}
            </span>
            <span className="text-[15px] font-medium tnum">{stat.value}</span>
          </div>
        ))}
      </div>

      <ol className="flex flex-col">
        {ordered.map((entry, index) => {
          const meta = STATUS_META[entry.status];
          const Icon = meta.icon;

          return (
            <li key={entry.id} className="flex gap-3">
              <span className="flex flex-col items-center pt-1">
                <Icon
                  className={cn(
                    "size-3.5 shrink-0",
                    meta.className,
                    entry.status === "running" && "animate-spin",
                  )}
                />
                {index < ordered.length - 1 ? (
                  <span aria-hidden="true" className="mt-1 w-px flex-1 bg-line" />
                ) : null}
              </span>

              <span className="flex min-w-0 flex-1 flex-col gap-1 pb-4">
                <span className="flex flex-wrap items-baseline gap-2">
                  <span className="text-[13px] font-medium text-ink">
                    {STEP_LABELS[entry.step]}
                  </span>
                  <span className="text-[11px] text-ink-3 tnum">
                    {formatTime(entry.timestamp)}
                  </span>
                  <span className="text-[11px] text-ink-3 tnum">
                    {(entry.durationMs / 1000).toFixed(2)}s · {entry.tokens} tokens
                  </span>
                </span>

                <p className="text-[12.5px] leading-relaxed text-ink-2">{entry.message}</p>

                <span className="font-mono text-[10.5px] text-ink-3">{entry.model}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
