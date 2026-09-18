"use client";

import {
  CalendarClock,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  List,
  Play,
  Rows3,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { CalendarCard } from "@/components/content/calendar-card";
import { EmptyState } from "@/components/feedback/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getBrand } from "@/data/brands";
import { MOCK_NOW } from "@/data/time";
import { ApproveScheduleDialog } from "@/features/schedule/components/approve-schedule-dialog";
import { AuditLog } from "@/features/schedule/components/audit-log";
import { PublishingQueue } from "@/features/schedule/components/publishing-queue";
import { TimelineView } from "@/features/schedule/components/timeline-view";
import { useScopedPosts } from "@/hooks/use-scope";
import { useSchedule } from "@/hooks/use-schedule";
import { buildMonthCalendar, formatMonthLabel, WEEKDAY_LABELS } from "@/lib/calendar";
import { formatDateTime, formatTime } from "@/lib/format";
import { schedulingBlocker } from "@/lib/scheduling/rules";
import { cn } from "@/lib/utils";
import type { Post, ScheduleEntry } from "@/types";

/**
 * The scheduling cockpit.
 *
 * Three views over one truth: the month calendar (drag an approved post onto
 * a day to book it), the 48-hour timeline, and the flat list. The publishing
 * queue and audit log share the page because scheduling is not done at
 * booking — it is done when the slot actually fires.
 */

type ViewMode = "calendar" | "timeline" | "list";

function StatsCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-line bg-surface p-3">
      <span className="text-[11px] text-ink-3">{label}</span>
      <div className="flex items-end justify-between">
        <span className="text-[22px] font-medium tracking-[-0.02em] text-ink tnum">
          {value}
        </span>
        <span className={cn("size-1.5 rounded-full", color)} />
      </div>
      <div className="h-1 w-full rounded-full bg-surface-2">
        <div
          className={cn("h-full rounded-full transition-all", color)}
          style={{ width: `${Math.min(100, (value / 10) * 100)}%` }}
        />
      </div>
    </div>
  );
}

function startOfUtcDay(iso: string) {
  return iso.slice(0, 10);
}

function entryMergesIntoCalendar(
  entries: ScheduleEntry[],
): Map<string, ScheduleEntry[]> {
  const map = new Map<string, ScheduleEntry[]>();
  for (const entry of entries) {
    if (entry.status !== "scheduled" && entry.status !== "publishing") continue;
    const key = startOfUtcDay(entry.scheduledFor);
    map.set(key, [...(map.get(key) ?? []), entry]);
  }
  return map;
}

export function ScheduleView() {
  const items = useScopedPosts();
  const controller = useSchedule();

  const [view, setView] = useState<ViewMode>("calendar");
  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedIso, setSelectedIso] = useState<string | null>(null);
  const [dragOverIso, setDragOverIso] = useState<string | null>(null);
  const [dialogPost, setDialogPost] = useState<Post | null>(null);
  const [dialogTime, setDialogTime] = useState<string | null>(null);

  const anchor = useMemo(() => {
    const date = new Date(MOCK_NOW);
    date.setUTCMonth(date.getUTCMonth() + monthOffset);
    return date;
  }, [monthOffset]);

  const calendar = useMemo(() => buildMonthCalendar(items, anchor), [items, anchor]);
  const slotsByDay = useMemo(
    () => entryMergesIntoCalendar(controller.entries),
    [controller.entries],
  );

  /** Approved posts available for drag-and-drop booking. */
  const approved = useMemo(
    () => items.filter((post) => post.status === "approved"),
    [items],
  );

  const scheduledEntries = useMemo(
    () =>
      controller.entries
        .filter((entry) => entry.status === "scheduled" || entry.status === "publishing")
        .sort(
          (a, b) =>
            new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime(),
        ),
    [controller.entries],
  );

  const filled = calendar.filter((day) => day.inCurrentMonth && day.items.length > 0)
    .length;

  const openDialog = (post: Post, time?: string | null) => {
    setDialogTime(time ?? null);
    setDialogPost(post);
  };

  return (
    <>
      <PageHeader
        eyebrow="Schedule"
        title="When posts go live"
        description="Drag approved posts to pick a day. The calendar shows what's booked and what's open."
        actions={
          <>
            {view === "calendar" ? (
              <div className="flex items-center gap-1 rounded-full border border-line bg-surface p-0.5">
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Previous month"
                  onClick={() => setMonthOffset((current) => current - 1)}
                >
                  <ChevronLeft />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setMonthOffset(0)}
                  aria-label="Jump to current month"
                >
                  Today
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Next month"
                  onClick={() => setMonthOffset((current) => current + 1)}
                >
                  <ChevronRight />
                </Button>
              </div>
            ) : null}
            <Button
              variant="primary"
              onClick={() => void controller.tick()}
              disabled={controller.loading}
            >
              <Play />
              Run scheduler now
            </Button>
          </>
        }
        toolbar={
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Tabs value={view} onValueChange={(value) => setView(value as ViewMode)}>
              <TabsList aria-label="Schedule view">
                <TabsTrigger value="calendar">
                  <CalendarDays />
                  Calendar
                </TabsTrigger>
                <TabsTrigger value="timeline">
                  <Rows3 />
                  Timeline
                </TabsTrigger>
                <TabsTrigger value="list">
                  <List />
                  List
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {view === "calendar" ? (
              <ul className="flex items-center gap-3 text-[11.5px] text-ink-3">
                <li className="flex items-center gap-3">
                  <span className="font-medium text-ink-2">
                    {formatMonthLabel(anchor)}
                  </span>
                  <Badge tone="neutral" size="sm">
                    {filled} publishing days
                  </Badge>
                </li>
                <li className="flex items-center gap-1.5">
                  <span aria-hidden="true" className="size-1.5 rounded-full bg-warning" />
                  Approved, awaiting slot
                </li>
                <li className="flex items-center gap-1.5">
                  <span aria-hidden="true" className="size-1.5 rounded-full bg-ink" />
                  Scheduled
                </li>
                <li className="flex items-center gap-1.5">
                  <span aria-hidden="true" className="size-1.5 rounded-full bg-success" />
                  Published
                </li>
              </ul>
            ) : null}
          </div>
        }
      />

      <div className="shell-container flex flex-col gap-4 pb-8">
        {/* ------------------------------------------------ Stats Row --- */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatsCard
            label="Approved"
            value={approved.length}
            color="bg-warning"
          />
          <StatsCard
            label="Scheduled"
            value={scheduledEntries.length}
            color="bg-ink"
          />
          <StatsCard
            label="Publishing days"
            value={filled}
            color="bg-success"
          />
          <StatsCard
            label="Total slots"
            value={controller.entries.length}
            color="bg-primary"
          />
        </div>

        {/* ------------------------------------------------ Approved tray --- */}
        {approved.length > 0 && view === "calendar" ? (
          <Card className="gap-0 border-dashed">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[13px]">
                <CalendarClock className="size-3.5 text-ink-2" />
                Approved, awaiting slot
                <Badge tone="warning" size="sm" className="ml-auto tnum">
                  {approved.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-1.5 pt-0">
              {approved.map((post) => {
                const brand = getBrand(post.brandId);
                return (
                  <button
                    key={post.id}
                    type="button"
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.setData("text/plain", post.id);
                      event.dataTransfer.effectAllowed = "copy";
                    }}
                    onClick={() => openDialog(post)}
                    className="flex max-w-64 cursor-grab items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-left text-[12px] font-medium text-ink transition-colors hover:bg-surface-2 active:cursor-grabbing"
                    title={`${post.title} — drag onto a day, or click to pick a time`}
                  >
                    <span
                      aria-hidden="true"
                      className="size-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: brand.colorTheme.accent }}
                    />
                    <span className="truncate">{post.title}</span>
                  </button>
                );
              })}
            </CardContent>
          </Card>
        ) : null}

        {/* ----------------------------------------------------- Views ------ */}
        {view === "calendar" ? (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
            <Card className="gap-0 p-3 xl:col-span-8">
              <div className="grid grid-cols-7 gap-2 pb-2">
                {WEEKDAY_LABELS.map((label) => (
                  <span
                    key={label}
                    className="px-1 font-mono text-[10px] tracking-[0.1em] text-ink-3 uppercase"
                  >
                    {label}
                  </span>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-2">
                {calendar.map((day) => {
                  const daySlots = slotsByDay.get(day.iso) ?? [];
                  const canDrop =
                    approved.length > 0 &&
                    new Date(`${day.iso}T12:00:00Z`).getTime() >=
                      MOCK_NOW.getTime() - 24 * 60 * 60_000;

                  return (
                    <div
                      key={day.iso}
                      onDragOver={(event) => {
                        if (!canDrop) return;
                        event.preventDefault();
                        setDragOverIso(day.iso);
                      }}
                      onDragLeave={() =>
                        setDragOverIso((current) =>
                          current === day.iso ? null : current,
                        )
                      }
                      onDrop={(event) => {
                        event.preventDefault();
                        setDragOverIso(null);
                        const postId = event.dataTransfer.getData("text/plain");
                        const post = items.find((candidate) => candidate.id === postId);
                        if (!post) return;
                        const blocker = schedulingBlocker(post.status);
                        if (blocker) return;
                        // Drop lands at 18:30 local on that day; the dialog
                        // lets the reviewer fine-tune before booking.
                        const drop = new Date(`${day.iso}T18:30:00`);
                        openDialog(post, drop.toISOString());
                      }}
                      className={cn(
                        "relative rounded-md transition-shadow duration-150 ease-soft",
                        canDrop && dragOverIso === day.iso && "ring-2 ring-ink/30",
                      )}
                    >
                      <CalendarCard
                        day={day}
                        selected={day.iso === selectedIso}
                        onSelect={(target) => setSelectedIso(target.iso)}
                      />
                      {daySlots.length > 0 ? (
                        <div className="flex flex-wrap gap-1 px-2 pb-1.5">
                          {daySlots.slice(0, 2).map((entry) => (
                            <span
                              key={entry.id}
                              className="inline-flex items-center gap-1 rounded-full bg-ink px-1.5 py-0.5 font-mono text-[9.5px] text-canvas tnum"
                              title={entry.postTitle}
                            >
                              {formatTime(entry.scheduledFor)}
                            </span>
                          ))}
                          {daySlots.length > 2 ? (
                            <span className="font-mono text-[9.5px] text-ink-3 tnum">
                              +{daySlots.length - 2}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card className="xl:col-span-4">
              <CardHeader>
                <CardTitle>Next slots</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {scheduledEntries.length === 0 ? (
                  <EmptyState
                    icon={CalendarClock}
                    size="sm"
                    title="No slots booked"
                    description="Drag an approved post onto a day, or click it to pick a time."
                  />
                ) : (
                  <ul className="flex flex-col divide-y divide-line">
                    {scheduledEntries.slice(0, 6).map((entry) => (
                      <li key={entry.id} className="flex items-center gap-3 py-2.5">
                        <div className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate text-[13px] font-medium text-ink">
                            {entry.postTitle}
                          </span>
                          <span className="font-mono text-[11px] text-ink-2 tnum">
                            {entry.igPage} · {formatDateTime(entry.scheduledFor)}
                          </span>
                        </div>
                        <Badge
                          tone={entry.status === "publishing" ? "warning" : "neutral"}
                          size="sm"
                        >
                          {entry.status}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        ) : null}

        {view === "timeline" ? (
          <Card className="gap-0 p-4">
            <TimelineView entries={controller.entries} />
          </Card>
        ) : null}

        {view === "list" ? (
          <Card className="gap-0">
            <CardHeader>
              <CardTitle>Slot list</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {controller.loading ? (
                <p className="py-4 text-[13px] text-ink-3">Loading slots…</p>
              ) : scheduledEntries.length === 0 ? (
                <EmptyState
                  icon={CalendarClock}
                  size="sm"
                  title="Nothing scheduled"
                  description="Approved posts appear here once they are given a slot."
                />
              ) : (
                <div className="overflow-x-auto scrollbar-slim">
                  <table className="w-full min-w-[640px] border-collapse text-left">
                    <thead>
                      <tr className="border-b border-line text-[11px] tracking-[0.06em] text-ink-3 uppercase">
                        <th className="py-2 pr-3 font-medium">Post</th>
                        <th className="py-2 pr-3 font-medium">Page</th>
                        <th className="py-2 pr-3 font-medium">When</th>
                        <th className="py-2 pr-3 font-medium">Status</th>
                        <th className="py-2 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scheduledEntries.map((entry) => (
                        <tr
                          key={entry.id}
                          className="border-b border-line/60 text-[13px] last:border-0"
                        >
                          <td className="py-2.5 pr-3 font-medium text-ink">
                            {entry.postTitle}
                          </td>
                          <td className="py-2.5 pr-3 font-mono text-[12px] text-ink-2">
                            {entry.igPage}
                          </td>
                          <td className="py-2.5 pr-3 text-ink-2 tnum">
                            {formatDateTime(entry.scheduledFor)}
                          </td>
                          <td className="py-2.5 pr-3">
                            <Badge
                              tone={
                                entry.status === "publishing" ? "warning" : "neutral"
                              }
                              size="sm"
                            >
                              {entry.status}
                            </Badge>
                          </td>
                          <td className="py-2.5 text-right">
                            <Button
                              size="xs"
                              variant="ghost"
                              disabled={controller.busyIds.includes(entry.id)}
                              onClick={() => void controller.withdraw(entry.id)}
                            >
                              Withdraw
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        ) : null}

        {/* --------------------------------------- Publishing queue + audit -- */}
        <PublishingQueue controller={controller} />
        <AuditLog />

        <Button asChild variant="secondary" className="w-fit">
          <Link href="/queue">Back to queue</Link>
        </Button>
      </div>

      <ApproveScheduleDialog
        post={dialogPost}
        open={dialogPost !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDialogPost(null);
            setDialogTime(null);
          }
        }}
        initialTime={dialogTime}
      />
    </>
  );
}
