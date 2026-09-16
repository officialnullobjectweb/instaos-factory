"use client";

import {
  CircleAlert,
  CircleCheck,
  CircleDashed,
  ExternalLink,
  FileClock,
  RefreshCw,
  Wrench,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { EmptyState } from "@/components/feedback/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Drawer } from "@/components/ui/drawer";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { AI_ACTIVITY_EVENT } from "@/lib/constants";
import { aiApi } from "@/lib/api/ai-client";
import {
  AI_ERROR_LABELS,
  AI_PROVIDER_LABELS,
  AI_STEP_LABELS,
  formatLatency,
  formatTokens,
} from "@/lib/ai/ui";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AiLogEntry, AiLogSummary, AiProviderDescriptor } from "@/types";

/**
 * The AI engine, as seen from the dashboard.
 *
 * Every request and response the engine makes is stored server-side; this panel
 * shows the tail of that trail and lets a reviewer open any entry to read the
 * exact prompt that was sent and the raw text that came back. When the engine
 * falls back mid-run, that is visible here as a provider change rather than
 * something you have to infer from a wrong-looking post.
 */
export function AiLogs() {
  const [logs, setLogs] = useState<AiLogEntry[]>([]);
  const [summary, setSummary] = useState<AiLogSummary | null>(null);
  const [providers, setProviders] = useState<AiProviderDescriptor[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [open, setOpen] = useState<AiLogEntry | null>(null);

  const load = useCallback(async () => {
    try {
      const [logResult, providerResult] = await Promise.all([
        aiApi.logs({ limit: 12 }),
        aiApi.providers(),
      ]);
      setLogs(logResult.logs);
      setSummary(logResult.summary);
      setProviders(providerResult.providers);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void load();

    // A generation finishing anywhere in the workspace refreshes this panel.
    window.addEventListener(AI_ACTIVITY_EVENT, load);
    return () => window.removeEventListener(AI_ACTIVITY_EVENT, load);
  }, [load]);

  const successRate =
    summary && summary.total > 0
      ? Math.round((summary.succeeded / summary.total) * 100)
      : null;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <CardTitle>AI engine</CardTitle>
              <p className="text-[13px] text-ink-2">
                Every request and response, newest first. Fallbacks are logged as
                they happen.
              </p>
            </div>

            <div className="flex items-center gap-1.5">
              {providers
                .filter((provider) => provider.priority < 3)
                .map((provider) => (
                  <Badge
                    key={provider.id}
                    tone={provider.configured ? "success-outline" : "neutral"}
                    size="sm"
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "size-1.5 rounded-full",
                        provider.configured ? "bg-success" : "bg-ink-3",
                      )}
                    />
                    {provider.label}
                    {provider.roles.includes("primary") ? (
                      <span className="text-ink-3">primary</span>
                    ) : null}
                  </Badge>
                ))}

              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Refresh AI log"
                onClick={() => void load()}
              >
                <RefreshCw />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-4 pt-0">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border border-line bg-surface-2 p-3.5 sm:grid-cols-4">
            <Metric label="Model calls" value={summary ? String(summary.total) : "—"} />
            <Metric
              label="Success rate"
              value={successRate === null ? "—" : `${successRate}%`}
            />
            <Metric
              label="Avg latency"
              value={summary ? formatLatency(summary.averageLatencyMs) : "—"}
            />
            <Metric
              label="Fallback share"
              value={summary ? `${Math.round(summary.fallbackRate * 100)}%` : "—"}
            />
          </dl>

          {status === "loading" ? (
            <div className="flex flex-col gap-2">
              {[0, 1, 2].map((row) => (
                <Skeleton key={row} className="h-14 w-full rounded-lg" />
              ))}
            </div>
          ) : status === "error" ? (
            <EmptyState
              icon={CircleAlert}
              size="sm"
              title="Could not read the AI log"
              description="The server did not return the log file. It is safe to retry."
              action={
                <Button variant="secondary" size="sm" onClick={() => void load()}>
                  <RefreshCw />
                  Retry
                </Button>
              }
            />
          ) : logs.length === 0 ? (
            <EmptyState
              icon={FileClock}
              size="sm"
              title="No model calls yet"
              description="Generate a post and the full request/response trail appears here."
            />
          ) : (
            <ScrollArea className="max-h-[22rem]">
              <ul className="flex flex-col divide-y divide-line">
                {logs.map((entry) => (
                  <LogRow key={entry.id} entry={entry} onOpen={() => setOpen(entry)} />
                ))}
              </ul>
            </ScrollArea>
          )}

          {status === "ready" && summary?.lastFailure ? (
            <p className="text-[11.5px] leading-relaxed text-ink-3">
              Last failure: {summary.lastFailure}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Drawer
        open={open !== null}
        onOpenChange={(next) => (next ? null : setOpen(null))}
        title={open ? AI_STEP_LABELS[open.step] : ""}
        description={
          open
            ? `${AI_PROVIDER_LABELS[open.provider]} · ${open.model} · attempt ${open.attempt}`
            : undefined
        }
      >
        {open ? <LogDetail entry={open} /> : null}
      </Drawer>
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[11px] tracking-[0.04em] text-ink-3 uppercase">{label}</dt>
      <dd className="text-[15px] font-medium text-ink tnum">{value}</dd>
    </div>
  );
}

function LogRow({ entry, onOpen }: { entry: AiLogEntry; onOpen: () => void }) {
  const failed = entry.status === "error";

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center gap-3 py-2.5 text-left transition-colors duration-150 ease-soft hover:bg-surface-2"
      >
        {failed ? (
          <CircleAlert className="size-3.5 shrink-0 text-danger" aria-hidden="true" />
        ) : (
          <CircleCheck className="size-3.5 shrink-0 text-success" aria-hidden="true" />
        )}

        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-center gap-2">
            <span className="truncate text-[12.5px] text-ink">
              {AI_STEP_LABELS[entry.step]}
            </span>
            {entry.repairs.length > 0 ? (
              <Badge tone="warning" size="sm">
                <Wrench className="size-3" />
                {entry.repairs.length} repaired
              </Badge>
            ) : null}
          </span>
          <span className="truncate text-[11.5px] text-ink-3">
            {AI_PROVIDER_LABELS[entry.provider]} · {entry.model}
          </span>
        </span>

        <span className="hidden shrink-0 text-[11.5px] text-ink-3 sm:block tnum">
          {formatTokens(entry.usage?.totalTokens)}
        </span>
        <span className="shrink-0 text-[11.5px] text-ink-2 tnum">
          {formatLatency(entry.latencyMs)}
        </span>
        <span className="hidden shrink-0 text-[11.5px] text-ink-3 md:block tnum">
          {formatDateTime(entry.createdAt)}
        </span>
      </button>
    </li>
  );
}

function LogDetail({ entry }: { entry: AiLogEntry }) {
  return (
    <div className="flex flex-col gap-5 pb-6">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border border-line bg-surface-2 p-3.5">
        <Metric label="Status" value={entry.status === "error" ? "Failed" : "Succeeded"} />
        <Metric label="Latency" value={formatLatency(entry.latencyMs)} />
        <Metric label="Tokens" value={formatTokens(entry.usage?.totalTokens)} />
        <Metric
          label="Prompt / completion"
          value={`${formatTokens(entry.usage?.inputTokens)} / ${formatTokens(entry.usage?.outputTokens)}`}
        />
      </dl>

      {entry.error ? (
        <div className="flex flex-col gap-1 rounded-lg border border-danger/25 bg-danger-soft p-3.5">
          <span className="text-[12px] font-medium text-danger">
            {AI_ERROR_LABELS[entry.error.kind]}
          </span>
          <span className="text-[12.5px] leading-relaxed text-ink-2">
            {entry.error.message}
            {entry.error.httpStatus ? ` (HTTP ${entry.error.httpStatus})` : ""}
          </span>
        </div>
      ) : null}

      {entry.repairs.length > 0 ? (
        <div className="flex flex-col gap-1.5 rounded-lg border border-warning/25 bg-warning-soft p-3.5">
          <span className="text-[12px] font-medium text-warning">
            Repairs applied before parsing
          </span>
          {entry.repairs.map((repair) => (
            <span key={repair} className="text-[12.5px] leading-relaxed text-ink-2">
              {repair}
            </span>
          ))}
        </div>
      ) : null}

      <Payload title="System prompt" body={entry.request.system} />
      <Payload title="User prompt" body={entry.request.user} />

      {entry.request.options ? (
        <Payload
          title="Request options"
          body={JSON.stringify(entry.request.options, null, 2)}
        />
      ) : null}

      <Payload
        title="Response"
        body={entry.response?.text ?? "No response was recorded."}
      />

      {entry.response?.parsed ? (
        <Payload
          title="Parsed payload"
          body={JSON.stringify(entry.response.parsed, null, 2)}
          tone="success"
        />
      ) : null}

      <p className="flex items-center gap-1.5 text-[11.5px] text-ink-3">
        <CircleDashed className="size-3" aria-hidden="true" />
        Job {entry.jobId ?? "—"} · stored in data/ai-logs.json
        <ExternalLink className="size-3" aria-hidden="true" />
      </p>
    </div>
  );
}

function Payload({
  title,
  body,
  tone = "neutral",
}: {
  title: string;
  body: string;
  tone?: "neutral" | "success";
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[11px] tracking-[0.06em] text-ink-3 uppercase">
        {title}
      </span>
      <pre
        className={cn(
          "scrollbar-slim max-h-72 overflow-auto rounded-lg border border-line p-3.5 font-mono text-[11.5px] leading-relaxed whitespace-pre-wrap",
          tone === "success" ? "bg-success-soft text-ink" : "bg-surface-2 text-ink-2",
        )}
      >
        {body}
      </pre>
    </div>
  );
}
