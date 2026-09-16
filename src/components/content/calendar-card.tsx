"use client";

import Image from "next/image";

import { getBrand } from "@/data/brands";
import type { CalendarDay } from "@/lib/calendar";
import { formatTime } from "@/lib/format";
import { CONTENT_STATUS_META } from "@/lib/status";
import { cn } from "@/lib/utils";

interface CalendarCardProps {
  day: CalendarDay;
  variant?: "grid" | "strip";
  selected?: boolean;
  onSelect?: (day: CalendarDay) => void;
}

export function CalendarCard({
  day,
  variant = "grid",
  selected = false,
  onSelect,
}: CalendarCardProps) {
  const isStrip = variant === "strip";
  const visible = isStrip ? day.items.slice(0, 2) : day.items.slice(0, 3);
  const overflow = day.items.length - visible.length;

  return (
    <div
      className={cn(
        "flex flex-col rounded-md border transition-colors duration-150 ease-soft",
        isStrip ? "min-h-28 gap-1.5 p-2.5" : "min-h-32 gap-1.5 p-2",
        day.inCurrentMonth ? "border-line bg-surface" : "border-line/60 bg-surface-2/60",
        selected && "border-ink ring-2 ring-ink/10",
      )}
    >
      <button
        type="button"
        onClick={() => onSelect?.(day)}
        aria-label={`${day.date}, ${day.items.length} items`}
        aria-pressed={selected}
        className="flex items-center justify-between gap-1 rounded-xs px-0.5 text-[11px] outline-none"
      >
        <span
          className={cn(
            "flex size-5 items-center justify-center rounded-full font-medium tnum",
            day.isToday ? "bg-ink text-canvas" : "text-ink-2",
            !day.inCurrentMonth && !day.isToday && "text-ink-3",
          )}
        >
          {day.date}
        </span>

        {day.items.length > 0 ? (
          <span className="font-mono text-[10px] text-ink-3 tnum">
            {day.items.length}
          </span>
        ) : null}
      </button>

      <div className="flex flex-1 flex-col gap-1">
        {visible.map((item) => {
          const brand = getBrand(item.brandId);
          const meta = CONTENT_STATUS_META[item.status];

          return (
            <div
              key={item.id}
              className="flex items-center gap-1.5 rounded-xs bg-surface-2 px-1.5 py-1"
              title={`${brand.name} · ${meta.label}`}
            >
              <span
                className={cn(
                  "size-1.5 shrink-0 rounded-full",
                  item.status === "scheduled" && "bg-ink",
                  item.status === "published" && "bg-success",
                  item.status === "approved" && "bg-ink-3",
                  item.status === "pending_review" && "bg-warning",
                  item.status === "failed" && "bg-danger",
                  item.status === "rejected" && "bg-danger",
                  item.status === "draft" && "bg-line-strong",
                )}
                aria-hidden="true"
              />
              <span className="truncate text-[11px] leading-tight text-ink">
                {isStrip ? formatTime(item.scheduledFor ?? item.updatedAt) : item.title}
              </span>
              {isStrip ? null : (
                <Image
                  src={brand.logoSrc}
                  alt=""
                  width={12}
                  height={12}
                  className="ml-auto size-3 shrink-0 rounded-xs"
                />
              )}
            </div>
          );
        })}

        {overflow > 0 ? (
          <span className="px-1 font-mono text-[10px] text-ink-3">
            +{overflow} more
          </span>
        ) : null}
      </div>
    </div>
  );
}
