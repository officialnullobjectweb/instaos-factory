"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

import { CalendarCard } from "@/components/content/calendar-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MOCK_NOW } from "@/data/time";
import { buildWeekStrip, formatMonthLabel } from "@/lib/calendar";
import { formatDateTime } from "@/lib/format";
import { upcomingScheduled } from "@/lib/metrics";
import type { ContentItem } from "@/types";

interface CalendarPreviewProps {
  items: ContentItem[];
}

export function CalendarPreview({ items }: CalendarPreviewProps) {
  const week = useMemo(() => buildWeekStrip(items), [items]);
  const nextUp = useMemo(() => upcomingScheduled(items, 1)[0], [items]);

  const scheduledThisWeek = week.reduce(
    (total, day) => total + day.items.length,
    0,
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-1">
          <CardTitle>This week</CardTitle>
          <p className="text-[13px] text-ink-2 tnum">
            {formatMonthLabel(MOCK_NOW)} · {scheduledThisWeek} slots filled
          </p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/schedule">
            Schedule
            <ArrowUpRight className="size-3.5" />
          </Link>
        </Button>
      </CardHeader>

      <CardContent className="flex flex-col gap-3 pt-0">
        <div className="grid grid-cols-7 gap-1.5">
          {week.map((day) => (
            <CalendarCard key={day.iso} day={day} variant="strip" />
          ))}
        </div>

        <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface-2 px-3.5 py-2.5">
          <span className="flex min-w-0 flex-col">
            <span className="text-[11px] tracking-[0.06em] text-ink-3 uppercase">
              Next publish
            </span>
            <span className="truncate text-[13px] text-ink">
              {nextUp?.title ?? "No slots booked yet"}
            </span>
          </span>
          {nextUp?.scheduledFor ? (
            <span className="shrink-0 text-[12px] text-ink-2 tnum">
              {formatDateTime(nextUp.scheduledFor)}
            </span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
