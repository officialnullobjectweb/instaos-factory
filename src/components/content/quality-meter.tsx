import { Badge } from "@/components/ui/badge";
import { QUALITY_VERDICT_META, qualityVerdict } from "@/lib/status";
import { cn } from "@/lib/utils";
import type { QualityVerdict } from "@/types";

const TONE_BAR: Record<QualityVerdict, string> = {
  excellent: "bg-success",
  strong: "bg-success/70",
  review: "bg-warning",
  weak: "bg-danger",
};

interface QualityMeterProps {
  score: number;
  /** Overrides the derived verdict, e.g. when comparing versions. */
  verdict?: QualityVerdict;
  size?: "sm" | "md";
  showVerdict?: boolean;
  className?: string;
  /** Hides the bar, leaving the number — used inside dense table cells. */
  bare?: boolean;
}

export function QualityMeter({
  score,
  verdict,
  size = "sm",
  showVerdict = false,
  bare = false,
  className,
}: QualityMeterProps) {
  const resolved = verdict ?? qualityVerdict(score);
  const meta = QUALITY_VERDICT_META[resolved];
  const Icon = meta.icon;

  return (
    <span className={cn("flex items-center gap-2", className)}>
      {bare ? null : (
        <span
          aria-hidden="true"
          className={cn(
            "relative overflow-hidden rounded-full bg-surface-3",
            size === "sm" ? "h-1 w-10" : "h-1.5 w-16",
          )}
        >
          <span
            className={cn("absolute inset-y-0 left-0 rounded-full", TONE_BAR[resolved])}
            style={{ width: `${Math.min(Math.max(score, 0), 100)}%` }}
          />
        </span>
      )}

      <span
        className={cn(
          "font-medium text-ink tnum",
          size === "sm" ? "text-[12.5px]" : "text-[13px]",
        )}
        aria-label={`Quality score ${score} of 100 — ${meta.label}`}
      >
        {score}
      </span>

      {showVerdict ? (
        <Badge tone={meta.tone} size="sm">
          <Icon className="size-3" />
          {meta.label}
        </Badge>
      ) : null}
    </span>
  );
}
