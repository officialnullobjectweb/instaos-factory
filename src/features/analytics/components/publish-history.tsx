"use client";

import { AtSign, ExternalLink, ImageIcon, RefreshCw, Send } from "lucide-react";
import { useMemo, useState } from "react";

import { MetricCard } from "@/components/content/metric-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { usePublishHistory } from "@/hooks/use-instagram";
import { cn } from "@/lib/utils";
import type { IgMediaKind, IgPublishRecord } from "@/types";

const KIND_LABEL: Record<IgMediaKind, string> = {
  carousel: "Carousel",
  single: "Single image",
  reel: "Reel",
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
}

/**
 * Publish history — the record of what actually left the building.
 *
 * Only successful publishes live here (failures are visible in the Schedule
 * pipeline queue), and each row carries the media id and permalink so a post
 * can be traced back to Instagram rather than trusted on the app's word.
 */
export function PublishHistory() {
  const { data, loading, reload } = usePublishHistory(100);
  const [query, setQuery] = useState("");
  const [handle, setHandle] = useState("all");
  const [kind, setKind] = useState("all");

  const records = useMemo(() => data?.records ?? [], [data]);

  const handles = useMemo(
    () => [...new Set(records.map((record) => record.handle))].sort(),
    [records],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return records.filter((record) => {
      if (handle !== "all" && record.handle !== handle) return false;
      if (kind !== "all" && record.mediaKind !== kind) return false;
      if (needle === "") return true;
      return (
        record.postTitle.toLowerCase().includes(needle) ||
        record.mediaId.toLowerCase().includes(needle)
      );
    });
  }, [records, query, handle, kind]);

  const summary = data?.summary;

  const avgSeconds = records.length
    ? Math.round(
        records.reduce((total, record) => total + record.elapsedMs, 0) /
          records.length /
          1000,
      )
    : 0;

  if (loading) {
    return (
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} className="h-24 w-full rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Published posts"
          value={summary?.total ?? 0}
          hint="Lifetime, all pages"
          compact
        />
        <MetricCard
          label="Last 7 days"
          value={summary?.last7Days ?? 0}
          hint="Throughput this week"
          compact
        />
        <MetricCard
          label="Connected pages"
          value={summary?.byAccount.length ?? 0}
          hint="Publishing destinations"
          compact
        />
        <MetricCard
          label="Avg publish time"
          value={avgSeconds}
          suffix="s"
          hint={
            summary?.lastPublishedAt
              ? `Last ${new Date(summary.lastPublishedAt).toLocaleDateString()}`
              : "Nothing published yet"
          }
          compact
        />
      </div>

      <Card>
        <CardHeader className="flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Publish history</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              aria-label="Search published posts"
              placeholder="Search title or media id…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-8 w-full text-[12.5px] sm:w-56"
            />
            <Select value={handle} onValueChange={setHandle}>
              <SelectTrigger size="sm" aria-label="Filter by page">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All pages</SelectItem>
                {handles.map((entry) => (
                  <SelectItem key={entry} value={entry}>
                    {entry}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={kind} onValueChange={setKind}>
              <SelectTrigger size="sm" aria-label="Filter by media kind">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All formats</SelectItem>
                <SelectItem value="carousel">Carousel</SelectItem>
                <SelectItem value="single">Single image</SelectItem>
                <SelectItem value="reel">Reel</SelectItem>
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void reload()}
              aria-label="Reload publish history"
            >
              <RefreshCw />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
              <span className="flex size-11 items-center justify-center rounded-full border border-line bg-surface-2 text-ink-2">
                <Send className="size-4" />
              </span>
              <div className="flex flex-col gap-1">
                <p className="text-[14px] font-medium text-ink">
                  {records.length === 0
                    ? "Nothing published yet"
                    : "No posts match these filters"}
                </p>
                <p className="mx-auto max-w-sm text-[12.5px] leading-relaxed text-ink-2">
                  {records.length === 0
                    ? "Once a scheduled slot completes on Instagram, its media id, permalink and timestamp land here."
                    : "Try clearing the search or switching the page filter."}
                </p>
              </div>
            </div>
          ) : (
            <div className="-mx-5 overflow-x-auto px-5">
              <table className="w-full min-w-[720px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-line">
                    {["Post", "Page", "Format", "Media id", "Published", "Duration", ""].map(
                      (heading) => (
                        <th
                          key={heading}
                          scope="col"
                          className="pb-2.5 pr-4 text-[11px] font-medium tracking-[0.06em] text-ink-3 uppercase"
                        >
                          {heading}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((record) => (
                    <PublishRow key={record.id} record={record} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PublishRow({ record }: { record: IgPublishRecord }) {
  const hasLink = record.permalink && record.permalink !== "https://www.instagram.com/";

  return (
    <tr className="group border-b border-line last:border-0">
      <td className="max-w-[240px] py-3 pr-4">
        <div className="flex items-center gap-2.5">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-line bg-surface-2 text-ink-3">
            <ImageIcon className="size-3.5" />
          </span>
          <span className="truncate text-[13px] text-ink">{record.postTitle}</span>
        </div>
      </td>
      <td className="py-3 pr-4">
        <span className="flex items-center gap-1.5 font-mono text-[12px] text-ink-2">
          <AtSign className="size-3.5" />
          {record.handle}
        </span>
      </td>
      <td className="py-3 pr-4">
        <Badge tone="outline">{KIND_LABEL[record.mediaKind]}</Badge>
      </td>
      <td className="py-3 pr-4">
        <span className="font-mono text-[12px] text-ink-2 tnum">
          {record.mediaId}
        </span>
      </td>
      <td className="py-3 pr-4">
        <span className="flex flex-col">
          <span className="text-[12.5px] text-ink">
            {new Date(record.publishedAt).toLocaleDateString()}
          </span>
          <span className="text-[11.5px] text-ink-3 tnum">
            {new Date(record.publishedAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </span>
      </td>
      <td className="py-3 pr-4">
        <span
          className={cn(
            "text-[12.5px] tnum",
            record.elapsedMs > 30_000 ? "text-warning" : "text-ink-2",
          )}
        >
          {formatDuration(record.elapsedMs)}
        </span>
      </td>
      <td className="py-3 text-right">
        {hasLink ? (
          <a
            href={record.permalink}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-[12px] text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
          >
            <ExternalLink className="size-3" />
            Open
          </a>
        ) : (
          <span className="text-[12px] text-ink-3">—</span>
        )}
      </td>
    </tr>
  );
}
