import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";
import { Sparkline } from "@/components/content/sparkline";
import { formatCompact, formatNumber, formatPercent } from "@/lib/format";
import { percentChange } from "@/lib/metrics";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  label: string;
  value: number;
  previous?: number;
  hint?: string;
  icon?: LucideIcon;
  compact?: boolean;
  suffix?: string;
  href?: string;
  trend?: number[];
  footer?: ReactNode;
  className?: string;
}

export function MetricCard({
  label,
  value,
  previous,
  hint,
  icon: Icon,
  compact = false,
  suffix,
  href,
  trend,
  footer,
  className,
}: MetricCardProps) {
  const delta = previous === undefined ? null : percentChange(value, previous);
  const direction = delta === null ? "flat" : delta > 0 ? "up" : delta < 0 ? "down" : "flat";
  const DeltaIcon =
    direction === "up" ? ArrowUpRight : direction === "down" ? ArrowDownRight : Minus;

  const formattedValue = compact ? formatCompact(value) : formatNumber(value);

  const body = (
    <Card
      className={cn(
        "h-full gap-4 p-5",
        href && "transition-transform duration-200 ease-soft hover:-translate-y-0.5 hover:shadow-soft",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          {Icon ? <Icon className="size-4 text-ink-3" /> : null}
          <span className="text-[13px] font-medium text-ink-2">{label}</span>
        </div>
        {trend?.length ? (
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
            {formattedValue}
            {suffix ? <span className="text-ink-2">{suffix}</span> : null}
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
            title={`vs previous period (${formatNumber(previous ?? 0)})`}
          >
            <DeltaIcon className="size-3.5" />
            {formatPercent(delta, { signed: true })}
          </span>
        ) : null}
      </div>

      {footer}
    </Card>
  );

  if (!href) return body;

  return (
    <Link href={href} className="block h-full rounded-xl outline-none">
      {body}
    </Link>
  );
}
