import { ArrowUpRight, BookOpen } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/feedback/empty-state";
import { formatDateShort } from "@/lib/format";
import { CREDIBILITY_META } from "@/lib/status";
import { cn } from "@/lib/utils";
import type { SourceRef } from "@/types";

interface SourceListProps {
  sources: SourceRef[];
  className?: string;
}

/** Research provenance — what the generator read, and how much it can be trusted. */
export function SourceList({ sources, className }: SourceListProps) {
  if (sources.length === 0) {
    return (
      <EmptyState
        icon={BookOpen}
        size="sm"
        title="No sources attached"
        description="This post was generated without a research pass, so nothing can be traced back."
      />
    );
  }

  return (
    <ul className={cn("flex flex-col divide-y divide-line", className)}>
      {sources.map((source) => {
        const credibility = CREDIBILITY_META[source.credibility];

        return (
          <li key={source.id} className="flex flex-col gap-2 py-3.5">
            <div className="flex items-start justify-between gap-3">
              <a
                href={source.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-[13.5px] font-medium text-ink hover:underline hover:underline-offset-4"
              >
                {source.title}
                <ArrowUpRight className="size-3.5 shrink-0 text-ink-3" />
              </a>

              <Badge tone={credibility.tone} size="sm">
                {credibility.label}
              </Badge>
            </div>

            <span className="flex flex-wrap items-center gap-2 text-[12px] text-ink-3">
              <span>{source.publisher}</span>
              <span aria-hidden="true">·</span>
              <span className="truncate font-mono text-[11px]">{source.url}</span>
              <span aria-hidden="true">·</span>
              <span>read {formatDateShort(source.accessedAt)}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
