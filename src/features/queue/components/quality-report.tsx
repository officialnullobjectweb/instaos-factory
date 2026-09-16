import { CircleAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { qualityVerdict, QUALITY_VERDICT_META } from "@/lib/status";
import { cn } from "@/lib/utils";
import type { QualityReport as QualityReportData } from "@/types";

interface QualityReportProps {
  report: QualityReportData;
  className?: string;
}

/** The reviewer's evidence for the score: every criterion, its weight, and why. */
export function QualityReport({ report, className }: QualityReportProps) {
  const verdict = QUALITY_VERDICT_META[report.verdict ?? qualityVerdict(report.score)];
  const VerdictIcon = verdict.icon;

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="flex items-start justify-between gap-4 rounded-lg border border-line bg-surface-2 p-4">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] tracking-[0.06em] text-ink-3 uppercase">
            Weighted score
          </span>
          <span className="flex items-baseline gap-2">
            <span className="text-[34px] leading-none font-medium tracking-[-0.03em] tnum">
              {report.score}
            </span>
            <span className="text-[13px] text-ink-3">/ 100</span>
          </span>
          <p className="max-w-80 text-[12.5px] leading-relaxed text-ink-2">
            {report.summary}
          </p>
        </div>

        <Badge tone={verdict.tone} size="md">
          <VerdictIcon className="size-3.5" />
          {verdict.label}
        </Badge>
      </div>

      {report.blockers.length > 0 ? (
        <div className="flex flex-col gap-2 rounded-lg border border-danger/20 bg-danger-soft p-3.5">
          <span className="flex items-center gap-2 text-[12px] font-medium text-danger">
            <CircleAlert className="size-3.5" />
            {report.blockers.length === 1
              ? "1 blocker before approval"
              : `${report.blockers.length} blockers before approval`}
          </span>
          <ul className="flex flex-col gap-1.5">
            {report.blockers.map((blocker) => (
              <li key={blocker} className="text-[12.5px] leading-relaxed text-danger">
                {blocker}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <ul className="flex flex-col divide-y divide-line">
        {report.criteria.map((criterion) => (
          <li key={criterion.id} className="flex flex-col gap-2 py-3.5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[13px] font-medium text-ink">{criterion.label}</span>
              <span className="flex items-center gap-2 text-[12px] text-ink-3 tnum">
                <span>{Math.round(criterion.weight * 100)}% weight</span>
                <span aria-hidden="true">·</span>
                <span className="text-ink">{criterion.score}</span>
              </span>
            </div>

            <Progress value={criterion.score} aria-label={`${criterion.label} score`} />

            <p className="text-[12.5px] leading-relaxed text-ink-2">{criterion.note}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
