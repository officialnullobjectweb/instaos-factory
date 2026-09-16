"use client";

import {
  AlertTriangle,
  Clock,
  RotateCcw,
  Send,
  CheckCircle2,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getBrand } from "@/data/brands";
import { MOCK_NOW } from "@/data/time";
import type { ScheduleController } from "@/hooks/use-schedule";
import { formatDateTime } from "@/lib/format";
import type { ScheduleEntry } from "@/types";

/**
 * The publishing queue as four live buckets. Every failed slot shows its
 * stored failure reason and — while retries remain — the 15-minute countdown
 * to the next automatic attempt.
 */

function relative(iso: string | null): string {
  if (!iso) return "—";
  const diff = new Date(iso).getTime() - MOCK_NOW.getTime();
  const minutes = Math.round(diff / 60_000);
  if (Math.abs(minutes) < 60) {
    return minutes >= 0 ? `in ${minutes}m` : `${-minutes}m ago`;
  }
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) {
    return hours >= 0 ? `in ${hours}h` : `${-hours}h ago`;
  }
  return formatDateTime(iso);
}

function SlotRow({
  entry,
  controller,
}: {
  entry: ScheduleEntry;
  controller: ScheduleController;
}) {
  const brand = getBrand(entry.brandId);
  const busy = controller.busyIds.includes(entry.id);
  const lastError = entry.attempts.at(-1)?.error ?? null;
  const nextRetry = entry.nextRetryAt;

  return (
    <li className="flex flex-col gap-2 rounded-md border border-line bg-surface p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-[13px] font-medium text-ink">
            {entry.postTitle ?? entry.postId}
          </span>
          <span className="text-[11.5px] text-ink-2">
            {brand.name} · {entry.igPage}
          </span>
        </div>
        <span className="flex shrink-0 items-center gap-1.5 font-mono text-[11px] text-ink-2 tnum">
          <Clock className="size-3" />
          {relative(entry.status === "published" ? entry.publishedAt : entry.scheduledFor)}
        </span>
      </div>

      {entry.status === "failed" && lastError ? (
        <p className="flex items-start gap-1.5 rounded-sm bg-danger-soft px-2 py-1.5 text-[11.5px] text-danger">
          <AlertTriangle className="mt-0.5 size-3 shrink-0" />
          <span className="min-w-0">
            {lastError}
            {entry.retryCount > 0 ? ` · ${entry.retryCount} attempt(s) so far` : ""}
          </span>
        </p>
      ) : null}

      {entry.status === "scheduled" && nextRetry ? (
        <p className="text-[11.5px] text-warning">
          Next automatic retry {relative(nextRetry)}
        </p>
      ) : null}

      <div className="flex items-center justify-between gap-2">
        <Badge
          tone={
            entry.status === "published"
              ? "success"
              : entry.status === "failed"
                ? "danger"
                : "neutral"
          }
          size="sm"
        >
          {entry.status}
        </Badge>

        <div className="flex items-center gap-1.5">
          {entry.status === "scheduled" ? (
            <Button
              size="xs"
              variant="ghost"
              disabled={busy}
              onClick={() => void controller.withdraw(entry.id)}
            >
              <X />
              Withdraw
            </Button>
          ) : null}
          {entry.status === "failed" ? (
            <Button
              size="xs"
              variant="secondary"
              disabled={busy || entry.retryCount >= 3}
              onClick={() => void controller.retry(entry.id)}
            >
              <RotateCcw />
              Retry
            </Button>
          ) : null}
        </div>
      </div>
    </li>
  );
}

const COLUMN_META = [
  { key: "upcoming", title: "Upcoming", icon: Clock },
  { key: "publishing", title: "Publishing", icon: Send },
  { key: "published", title: "Published (24h)", icon: CheckCircle2 },
  { key: "failed", title: "Failed", icon: AlertTriangle },
] as const;

export function PublishingQueue({ controller }: { controller: ScheduleController }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {COLUMN_META.map(({ key, title, icon: Icon }) => {
        const slots = controller.buckets[key];
        return (
          <Card key={key} className="gap-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[13.5px]">
                <Icon className="size-3.5 text-ink-2" />
                {title}
                <Badge tone="neutral" size="sm" className="ml-auto tnum">
                  {slots.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 pt-0">
              {controller.loading ? (
                <>
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </>
              ) : slots.length === 0 ? (
                <p className="py-3 text-[12.5px] text-ink-3">Nothing here.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {slots.map((entry) => (
                    <SlotRow key={entry.id} entry={entry} controller={controller} />
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
