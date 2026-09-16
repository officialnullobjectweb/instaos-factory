"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InsightsMetricCard } from "@/features/analytics/components/insights-metric-card";
import { TrendChart } from "@/features/analytics/components/trend-chart";
import { INSIGHT_METRICS, METRIC_BY_ID, type InsightMetricId } from "@/features/analytics/lib/metrics";
import { cn } from "@/lib/utils";
import type { Granularity, InsightPoint, InsightTotals } from "@/types";

/**
 * The dashboard grid and its charts.
 *
 * Both read from one `INSIGHT_METRICS` catalogue and one set of series points,
 * so the row of cards and the chart below it are always describing the same
 * window — the failure mode where a card says one thing and its chart another.
 */

export const WINDOW_OPTIONS = [
  { days: 7, label: "7 days" },
  { days: 28, label: "28 days" },
  { days: 84, label: "12 weeks" },
] as const;

export const GRANULARITY_OPTIONS: Array<{ id: Granularity; label: string }> = [
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
];

/** The metric the chart plots. A subset, because rates are hard to read as bars. */
export const CHART_METRICS: InsightMetricId[] = [
  "reach",
  "engagement",
  "saves",
  "follows",
];

/* --------------------------------- controls -------------------------------- */

export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: Array<{ id: T; label: string }>;
  value: T;
  onChange: (next: T) => void;
  label: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="flex w-fit items-center gap-0.5 rounded-full border border-line bg-surface p-0.5"
    >
      {options.map((option) => {
        const active = option.id === value;
        return (
          <button
            key={String(option.id)}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.id)}
            className={cn(
              "rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors duration-150 ease-soft",
              active ? "bg-ink text-canvas" : "text-ink-2 hover:text-ink",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/* ----------------------------------- grid ---------------------------------- */

export function InsightMetricGrid({
  totals,
  previousTotals,
  series,
  loading,
}: {
  totals: InsightTotals;
  previousTotals: InsightTotals;
  series: InsightPoint[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {INSIGHT_METRICS.map((metric) => (
          <Skeleton key={metric.id} className="h-[118px] w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {INSIGHT_METRICS.map((metric) => {
        const value = metric.fromTotals(totals);
        const previous = metric.fromTotals(previousTotals);
        return (
          <InsightsMetricCard
            key={metric.id}
            label={metric.label}
            display={metric.format(value)}
            value={value}
            previous={previous}
            hint={metric.hint}
            icon={metric.icon}
            trend={series.map((point) => metric.fromPoint(point))}
          />
        );
      })}
    </div>
  );
}

/* ---------------------------------- charts --------------------------------- */

export function InsightChart({
  series,
  metricId,
  granularity,
  hint,
  loading,
}: {
  series: InsightPoint[];
  metricId: InsightMetricId;
  granularity: Granularity;
  hint?: string;
  loading?: boolean;
}) {
  const metric = METRIC_BY_ID[metricId];

  const points = series.map((point) => ({
    label: point.label,
    value: metric.fromPoint(point),
    previous: metric.previousFromPoint(point),
  }));

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-1">
          <CardTitle>{metric.label}</CardTitle>
          <p className="text-[13px] text-ink-2">
            {hint ??
              `${granularity === "daily" ? "By day" : granularity === "weekly" ? "By week" : "By month"}, current against the previous period.`}
          </p>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {loading ? (
          <Skeleton className="h-[300px] w-full rounded-lg" />
        ) : (
          <TrendChart
            series={{
              id: `insights-${metricId}`,
              label: metric.label,
              unit: metric.percent ? "percent" : "count",
              summary: metric.hint,
              points,
            }}
            formatValue={metric.format}
            height={200}
          />
        )}
      </CardContent>
    </Card>
  );
}

/** All four chart metrics at once, for the overview's second row. */
export function InsightChartGrid({
  series,
  granularity,
  loading,
}: {
  series: InsightPoint[];
  granularity: Granularity;
  loading?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
      {CHART_METRICS.map((metricId) => (
        <InsightChart
          key={metricId}
          series={series}
          metricId={metricId}
          granularity={granularity}
          loading={loading}
        />
      ))}
    </div>
  );
}
