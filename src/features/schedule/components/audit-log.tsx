"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Clock,
  FileEdit,
  Pencil,
  RotateCcw,
  Send,
  Trash2,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState, type ComponentType, type SVGProps } from "react";

import { EmptyState } from "@/components/feedback/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fetchAudit } from "@/lib/api/schedule-client";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AuditAction, AuditEntry } from "@/types";

/**
 * Every approval, rejection, edit, schedule change and publish event — who,
 * what, when. Structured change rows (field: from → to) expand inline so the
 * log stays readable but nothing is hidden.
 */

const ACTION_META: Record<
  AuditAction,
  { label: string; icon: ComponentType<SVGProps<SVGSVGElement>>; className: string }
> = {
  created: { label: "Created", icon: FileEdit, className: "text-ink-2" },
  approved: { label: "Approved", icon: CheckCircle2, className: "text-success" },
  rejected: { label: "Rejected", icon: XCircle, className: "text-danger" },
  edited: { label: "Edited", icon: Pencil, className: "text-ink-2" },
  duplicated: { label: "Duplicated", icon: FileEdit, className: "text-ink-2" },
  deleted: { label: "Deleted", icon: Trash2, className: "text-danger" },
  scheduled: { label: "Scheduled", icon: Clock, className: "text-ink-2" },
  rescheduled: { label: "Moved", icon: Clock, className: "text-ink-2" },
  unscheduled: { label: "Withdrawn", icon: XCircle, className: "text-warning" },
  published: { label: "Published", icon: Send, className: "text-success" },
  publish_failed: {
    label: "Publish failed",
    icon: AlertTriangle,
    className: "text-danger",
  },
  retried: { label: "Retried", icon: RotateCcw, className: "text-warning" },
};

const FILTERS = [
  { value: "all", label: "All", actions: undefined as string[] | undefined },
  { value: "review", label: "Review", actions: ["approved", "rejected"] },
  { value: "edits", label: "Edits", actions: ["edited", "duplicated", "deleted"] },
  {
    value: "publishing",
    label: "Publishing",
    actions: [
      "scheduled",
      "rescheduled",
      "unscheduled",
      "published",
      "publish_failed",
      "retried",
    ],
  },
] as const;

function AuditRow({ entry }: { entry: AuditEntry }) {
  const [open, setOpen] = useState(false);
  const meta = ACTION_META[entry.action];
  const Icon = meta.icon;
  const hasChanges = entry.changes.length > 0;

  return (
    <li className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-line bg-surface-2">
          <Icon className={cn("size-3.5", meta.className)} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="text-[13px] font-medium text-ink">{entry.actor.name}</span>
            <span className="min-w-0 text-[13px] text-ink-2">{entry.detail}</span>
          </div>
          <span className="text-[11.5px] text-ink-3">
            {entry.postTitle ? `${entry.postTitle} · ` : ""}
            {formatDateTime(entry.createdAt)}
          </span>
        </div>

        {hasChanges ? (
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Toggle change details"
            aria-expanded={open}
            onClick={() => setOpen((current) => !current)}
          >
            <ChevronDown
              className={cn("transition-transform duration-200", open && "rotate-180")}
            />
          </Button>
        ) : null}
      </div>

      {open && hasChanges ? (
        <ul className="ml-10 flex flex-col gap-1 rounded-md border border-line bg-surface-2 p-2.5">
          {entry.changes.map((change, index) => (
            <li
              key={index}
              className="flex items-center gap-2 font-mono text-[11px] text-ink-2"
            >
              <span className="text-ink">{change.field}</span>
              <span className="truncate line-through opacity-60">{change.from}</span>
              <span aria-hidden="true">→</span>
              <span className="truncate text-ink">{change.to}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function AuditLog() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["value"]>("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const active = FILTERS.find((candidate) => candidate.value === filter);
      const next = await fetchAudit({
        actions: active?.actions ? [...active.actions] : undefined,
        limit: 200,
      });
      setEntries(next);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <CardTitle>Audit log</CardTitle>
            <p className="text-[12.5px] text-ink-2">
              Every approval, rejection, edit and publish event, with actor and time.
            </p>
            <div aria-hidden="true" className="hidden">
              <Badge tone="neutral" size="sm">
                {loading ? "loading" : "ready"}
              </Badge>
            </div>
          </div>
          <Tabs
            value={filter}
            onValueChange={(value) => setFilter(value as typeof filter)}
          >
            <TabsList aria-label="Audit filters">
              {FILTERS.map((option) => (
                <TabsTrigger key={option.value} value={option.value}>
                  {option.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {loading ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : entries.length === 0 ? (
          <EmptyState
            icon={Clock}
            size="sm"
            title="Nothing recorded yet"
            description="Approvals, rejections and edits will appear here as they happen."
          />
        ) : (
          <ul className="divide-y divide-line">
            {entries.map((entry) => (
              <AuditRow key={entry.id} entry={entry} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
