"use client";

import {
  Bot,
  CalendarDays,
  CircleCheck,
  CircleX,
  MessageSquare,
  Send,
  TriangleAlert,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { InitialsAvatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/feedback/empty-state";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getBrand } from "@/data/brands";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ActivityEvent, ActivityKind, BrandId } from "@/types";

const KIND_ICONS: Record<ActivityKind, LucideIcon> = {
  approval: CircleCheck,
  rejection: CircleX,
  schedule: CalendarDays,
  publish: Send,
  generation: Bot,
  comment: MessageSquare,
  failure: TriangleAlert,
  system: Zap,
};

interface RecentActivityProps {
  brandId: BrandId | "all";
  limit?: number;
}

/**
 * The real activity trail, derived from the audit log by `GET /api/activity`.
 *
 * Everything here actually happened: every approval, rejection, edit, schedule
 * and publish the system performed, newest first. With an empty audit log the
 * panel renders an honest empty state — the factory has not done anything yet.
 */
export function RecentActivity({ brandId, limit = 6 }: RecentActivityProps) {
  const [events, setEvents] = useState<ActivityEvent[] | null>(null);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    let cancelled = false;
    fetch("/api/activity?limit=24")
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { events?: ActivityEvent[] } | null) => {
        if (!cancelled && data?.events) setEvents(data.events);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = useMemo(
    () =>
      (events ?? [])
        .filter((event) => brandId === "all" || event.brandId === brandId)
        .slice(0, limit),
    [events, brandId, limit],
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-1">
          <CardTitle>Recent activity</CardTitle>
          <p className="text-[13px] text-ink-2">
            Every approval, publish and system event in one trail.
          </p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <a href="#activity-end">View all</a>
        </Button>
      </CardHeader>

      {events !== null && visible.length === 0 ? (
        <EmptyState
          icon={Zap}
          title="No activity yet"
          description="Approvals, publishes and edits will appear here as they happen."
        />
      ) : (
        <ScrollArea className="max-h-88 px-5 pb-5">
          <ol className="relative flex flex-col gap-4">
            <span
              aria-hidden="true"
              className="absolute top-2 bottom-2 left-[15px] w-px bg-line"
            />

            {visible.map((event) => {
              const Icon = KIND_ICONS[event.kind];
              const brand = event.brandId ? getBrand(event.brandId) : null;
              const initials = event.actor
                .split(/\s+/)
                .map((part) => part[0])
                .join("")
                .slice(0, 2)
                .toUpperCase();

              return (
                <li key={event.id} className="relative flex gap-3.5">
                  <InitialsAvatar
                    initials={initials}
                    size="sm"
                    className="relative z-10 shrink-0"
                    label={event.actor}
                  />

                  <div className="flex min-w-0 flex-col gap-1 pt-0.5">
                    <p className="text-[13px] leading-relaxed text-ink">
                      <span className="font-medium">{event.actor}</span>{" "}
                      <span className="text-ink-2">{event.message}</span>
                    </p>

                    <span className="flex items-center gap-2 text-[11px] text-ink-3">
                      <Icon
                        className={cn(
                          "size-3.5",
                          event.kind === "rejection" && "text-danger",
                          event.kind === "failure" && "text-danger",
                          event.kind === "approval" && "text-success",
                          event.kind === "publish" && "text-success",
                          event.kind === "generation" && "text-ink-2",
                        )}
                      />
                      <span>
                        {now ? formatRelativeTime(event.timestamp, now) : ""}
                      </span>
                      {brand ? (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{brand.name}</span>
                        </>
                      ) : null}
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
          <span id="activity-end" />
        </ScrollArea>
      )}
    </Card>
  );
}
