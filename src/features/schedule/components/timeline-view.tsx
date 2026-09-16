"use client";

import { Clock } from "lucide-react";
import { useMemo } from "react";

import { getBrand } from "@/data/brands";
import { MOCK_NOW } from "@/data/time";
import { formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ScheduleEntry } from "@/types";

/**
 * A 48-hour rail of upcoming slots. Slots render as pills at their time
 * offset; past 24h the pill simply sits in the "+1 day" half. Read-only and
 * dense — the operational detail lives in the publishing queue below.
 */

const HOURS = 48;

export function TimelineView({ entries }: { entries: ScheduleEntry[] }) {
  const now = MOCK_NOW.getTime();

  const slots = useMemo(
    () =>
      entries
        .filter((entry) => entry.status === "scheduled")
        .map((entry) => {
          const at = new Date(entry.scheduledFor).getTime();
          const offsetHours = (at - now) / 3_600_000;
          return { entry, at, offsetHours };
        })
        .filter((slot) => slot.offsetHours >= -1 && slot.offsetHours <= HOURS)
        .sort((a, b) => a.at - b.at),
    [entries, now],
  );

  const hourMarks = useMemo(
    () =>
      Array.from({ length: HOURS / 4 + 1 }, (_, index) => {
        const date = new Date(now + index * 4 * 3_600_000);
        return {
          label: index % 6 === 0 ? formatTime(date.toISOString()) : "",
          percent: (index * 4 * 100) / HOURS,
        };
      }),
    [now],
  );

  return (
    <div className="overflow-x-auto scrollbar-slim">
      <div className="relative h-28 min-w-[900px] rounded-lg border border-line bg-surface-2/60 px-4">
        {/* Hour ruler */}
        <div className="absolute inset-x-4 top-7 h-px bg-line-strong" aria-hidden="true" />
        {hourMarks.map((mark, index) => (
          <div
            key={index}
            className="absolute top-4 flex flex-col items-center"
            style={{ left: `calc(${mark.percent}% * 0.92 + 4%)` }}
            aria-hidden="true"
          >
            <span className="h-2 w-px bg-line-strong" />
            {mark.label ? (
              <span className="mt-1 font-mono text-[10px] text-ink-3 tnum">
                {mark.label}
              </span>
            ) : null}
          </div>
        ))}

        {/* Now marker */}
        <div
          className="absolute inset-y-3 left-[4%] w-px bg-ink"
          aria-hidden="true"
        >
          <span className="absolute -top-0.5 left-1 font-mono text-[9px] uppercase text-ink-3">
            now
          </span>
        </div>

        {/* Slots */}
        {slots.map(({ entry, offsetHours }) => {
          const brand = getBrand(entry.brandId);
          const percent = 4 + (Math.max(0, offsetHours) / HOURS) * 92;
          return (
            <div
              key={entry.id}
              className="absolute top-14"
              style={{ left: `${Math.min(percent, 94)}%` }}
            >
              <div
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] font-medium",
                  entry.status === "failed"
                    ? "border-danger/30 bg-danger-soft text-danger"
                    : "border-line bg-surface text-ink",
                )}
                title={`${entry.postTitle} · ${brand.name} · ${entry.igPage}`}
              >
                <span
                  aria-hidden="true"
                  className="size-1.5 rounded-full"
                  style={{ backgroundColor: brand.colorTheme.accent }}
                />
                <span className="max-w-40 truncate">{entry.postTitle}</span>
                <span className="font-mono text-[10px] text-ink-3 tnum">
                  {formatTime(entry.scheduledFor)}
                </span>
              </div>
            </div>
          );
        })}

        {slots.length === 0 ? (
          <p className="absolute inset-0 flex items-center justify-center text-[12.5px] text-ink-3">
            <Clock className="mr-2 size-3.5" />
            No upcoming slots in the next 48 hours.
          </p>
        ) : null}
      </div>
    </div>
  );
}
