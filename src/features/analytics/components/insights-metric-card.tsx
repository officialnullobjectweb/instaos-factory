import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Sparkline } from "@/components/content/sparkline";
import { formatPercent } from "@/lib/format";
import { percentChange } from "@/lib/metrics";
import { cn } from "@/lib/utils";

/**
 * A metric card for the insights dashboard.
 *
 * Takes an already-formatted value rather than a number: engagement rate needs
 * two decimals and a percent sign, follower growth needs a sign, and reach needs
 * thousands separators. The shared MetricCard formats internally, which is right
 * for the dashboard's whole-number metrics and wrong for all three of these.
 */

interface InsightsMetricCardProps {
  label: string;
  /** Pre-formatted, because the formats genuinely differ per metric. */
  display: string;
  value: number;
  previous?: number;
  hint?: string;
  icon?: LucideIcon;
  trend?: number[];
  /** Set when a lower value is the good outcome. */
  invertTrend?: boolean;
  className?: string;
}

export function InsightsMetricCard({
  label,
  display,
  value,
  previous,
  hint,
  icon: Icon,
  trend,
  invertTrend = false,
  className,
}: InsightsMetricCardProps) {
  const delta = previous === undefined ? null : percentChange(value, previous);
  const improved = delta === null ? null : invertTrend ? delta < 0 : delta > 0;
  const direction =
    delta === null || delta === 0 ? "flat" : improved ? "up" : "down";
  const DeltaIcon =
    direction === "up" ? ArrowUpRight : direction === "down" ? ArrowDownRight : Minus;

  return (
    <Card className={cn("h-full gap-4 p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          {Icon ? <Icon className="size-4 text-ink-3" /> : null}
          <span className="text-[13px] font-medium text-ink-2">{label}</span>
        </div>
        {trend && trend.length > 1 ? (
          <Sparkline
            data={trend}
            label={`${label} trend`}
            className="text-ink-3"
            width={72}
            height={24}
          />
        ) : null}
      </div>

      <div className="flex items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-[30px] leading-none font-medium tracking-[-0.03em] tnum">
            {display}
          </span>
          {hint ? <span className="text-[12px] text-ink-2">{hint}</span> : null}
        </div>

        {delta !== null ? (
          <span
            className={cn(
              "flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[12px] font-medium tnum",
              direction === "up" && "border-success/20 bg-success-soft text-success",
              direction === "down" && "border-danger/20 bg-danger-soft text-danger",
              direction === "flat" && "border-line bg-surface-2 text-ink-2",
            )}
            title="Versus the previous period of the same length"
          >
            <DeltaIcon className="size-3.5" />
            {formatPercent(delta, { signed: true })}
          </span>
        ) : null}
      </div>
    </Card>
  );
}
