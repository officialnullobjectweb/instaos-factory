"use client";

import { ArrowUpRight, CalendarPlus } from "lucide-react";
import Link from "next/link";

import { AssetPreview } from "@/components/content/asset-preview";
import { StatusBadge } from "@/components/content/status-badge";
import { EmptyState } from "@/components/feedback/empty-state";
import { Button } from "@/components/ui/button";
import { getBrand } from "@/data/brands";
import type { CalendarDay } from "@/lib/calendar";
import { formatTime } from "@/lib/format";
import { FORMAT_LABELS } from "@/lib/status";

interface DayInspectorProps {
  day: CalendarDay;
}

export function DayInspector({ day }: DayInspectorProps) {
  if (day.items.length === 0) {
    return (
      <EmptyState
        icon={CalendarPlus}
        size="sm"
        title="No content on this day"
        description="Pick a slot from the queue to fill this publishing window."
        action={
          <Button asChild variant="secondary" size="sm">
            <Link href="/queue">Open queue</Link>
          </Button>
        }
      />
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {day.items.map((item) => {
        const brand = getBrand(item.brandId);
        return (
          <li
            key={item.id}
            className="flex items-start gap-3 rounded-lg border border-line bg-surface p-3.5"
          >
            <AssetPreview
              format={item.format}
              frames={item.assetCount}
              seed={item.id}
            />

            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="flex items-start justify-between gap-2">
                <Link
                  href={`/queue?item=${item.id}`}
                  className="truncate text-[14px] font-medium text-ink hover:underline hover:underline-offset-4"
                >
                  {item.title}
                </Link>
                <StatusBadge status={item.status} size="sm" withIcon={false} />
              </div>

              <p className="text-[11.5px] text-ink-2">
                {brand.name} · {FORMAT_LABELS[item.format]} ·{" "}
                <span className="tnum">
                  {formatTime(item.scheduledFor ?? item.updatedAt)}
                </span>
              </p>

              <Link
                href={`/queue?item=${item.id}`}
                className="flex w-fit items-center gap-1 text-[11.5px] font-medium text-ink-2 hover:text-ink"
              >
                Review in queue
                <ArrowUpRight className="size-3" />
              </Link>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
