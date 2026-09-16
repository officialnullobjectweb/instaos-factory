import { formatCompact, formatPercent } from "@/lib/format";
import { percentChange } from "@/lib/metrics";
import { cn } from "@/lib/utils";
import type { MetricSeries } from "@/types";

interface TrendChartProps {
  series: MetricSeries;
  className?: string;
  height?: number;
  /**
   * Renders a bucket's value. Defaults to compact numbers; percentage series
   * pass this so a bar reading "9" for 8.6% cannot happen.
   */
  formatValue?: (value: number) => string;
}

/**
 * Two bars per point: the current period in ink, the previous period in a quiet
 * surface tone. Pure flexbox + percentage heights, no chart dependency.
 */
export function TrendChart({
  series,
  className,
  height = 220,
  formatValue = formatCompact,
}: TrendChartProps) {
  const max = Math.max(
    ...series.points.map((point) => Math.max(point.value, point.previous)),
  );

  const total = series.points.reduce((sum, point) => sum + point.value, 0);
  const previousTotal = series.points.reduce(
    (sum, point) => sum + point.previous,
    0,
  );
  const delta = percentChange(total, previousTotal);

  return (
    <figure className={cn("flex flex-col gap-4", className)}>
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <figcaption className="text-[13px] text-ink-2">
            {series.summary}
          </figcaption>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full border px-2 py-0.5 text-[12px] font-medium tnum",
            delta >= 0
              ? "border-success/20 bg-success-soft text-success"
              : "border-danger/20 bg-danger-soft text-danger",
          )}
        >
          {formatPercent(delta, { signed: true })}
        </span>
      </div>

      <div
        className="flex items-end gap-2"
        style={{ height }}
        role="img"
        aria-label={`${series.label} by day, current versus previous period`}
      >
        {series.points.map((point) => (
          <div
            key={point.label}
            className="flex h-full flex-1 flex-col items-center justify-end gap-2"
          >
            <div className="flex h-full w-full items-end justify-center gap-1">
              <div
                className="w-full max-w-7 rounded-t-xs bg-line-strong"
                style={{ height: `${Math.max(2, (point.previous / max) * 100)}%` }}
                title={`${point.label} previous · ${formatValue(point.previous)}`}
              />
              <div
                className="w-full max-w-7 rounded-t-xs bg-ink"
                style={{ height: `${Math.max(2, (point.value / max) * 100)}%` }}
                title={`${point.label} current · ${formatValue(point.value)}`}
              />
            </div>
            <span className="font-mono text-[10px] tracking-[0.08em] text-ink-3 uppercase">
              {point.label}
            </span>
          </div>
        ))}
      </div>

      <ul className="flex items-center gap-4 text-[11.5px] text-ink-3">
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2 rounded-xs bg-ink" />
          This period · {formatValue(total)}
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2 rounded-xs bg-line-strong" />
          Previous · {formatValue(previousTotal)}
        </li>
      </ul>

      <table className="sr-only">
        <caption>{series.label} current versus previous period</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">This week</th>
            <th scope="col">Last week</th>
          </tr>
        </thead>
        <tbody>
          {series.points.map((point) => (
            <tr key={point.label}>
              <th scope="row">{point.label}</th>
              <td>{point.value}</td>
              <td>{point.previous}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
