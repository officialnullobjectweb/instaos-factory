"use client";

import { CircleCheck, LoaderCircle, Play, Zap } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  AI_ACTIVITY_EVENT,
  AUTOMATION_PIPELINE,
} from "@/lib/constants";
import { formatDuration, formatRelativeTime } from "@/lib/format";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

/**
 * Live automation status from the real AI request log.
 *
 * `GET /api/system/health` derives every number from `ai-logs.json` — the runs
 * the engine actually performed. "Run pipeline now" calls the same generation
 * endpoint the dashboard's generate button uses; there is no second path.
 */
interface AutomationSnapshot {
  successRate: number;
  averageRuntimeSeconds: number;
  totalRuns: number;
  failedRuns: number;
  lastRunAt: string | null;
}

export function AutomationStatus() {
  const [snapshot, setSnapshot] = useState<AutomationSnapshot | null>(null);
  const [queued, setQueued] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/system/health");
      if (response.ok) {
        const data = (await response.json()) as { automation?: AutomationSnapshot };
        if (data.automation) {
          setSnapshot({
            ...data.automation,
            lastRunAt: data.automation.lastRunAt ?? null,
          });
        }
      }
    } catch {
      // transient — the panel keeps its last value
    }
  }, []);

  useEffect(() => {
    void load();
    const handler = () => void load();
    window.addEventListener(AI_ACTIVITY_EVENT, handler);
    return () => window.removeEventListener(AI_ACTIVITY_EVENT, handler);
  }, [load]);

  const total = snapshot?.totalRuns ?? 0;
  const completion = total === 0 ? 0 : Math.round((snapshot!.successRate) * 100);

  async function runNow() {
    setQueued(true);
    try {
      const response = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ brandId: "midnight-ritual" }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      toast.success("Generation started", {
        description: "A new post is being drafted — track it in the queue.",
      });
      window.dispatchEvent(new Event(AI_ACTIVITY_EVENT));
    } catch (error) {
      toast.error("Could not start generation", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setQueued(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-1">
          <CardTitle>Automation</CardTitle>
          <p className="text-[13px] text-ink-2">
            Generation runs, measured from the real request log
          </p>
        </div>
        <Badge tone={total > 0 ? "success" : "neutral"} size="sm">
          <Zap className="size-3" />
          {total > 0 ? "Live" : "Idle"}
        </Badge>
      </CardHeader>

      <CardContent className="flex flex-col gap-5 pt-0">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-[12px] text-ink-2">
            <span>Provider success rate</span>
            <span className="tnum">{completion}%</span>
          </div>
          <Progress
            value={completion}
            aria-label="Generation success rate"
          />
        </div>

        <ol className="flex flex-col gap-3">
          {AUTOMATION_PIPELINE.map((step, index) => {
            const done = total > 0 && index < 2;
            return (
              <li key={step.id} className="flex items-start gap-3">
                <span
                  className={cn(
                    "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border",
                    done
                      ? "border-transparent bg-ink text-canvas"
                      : "border-line bg-surface-2 text-ink-3",
                  )}
                >
                  {done ? (
                    <CircleCheck className="size-3" />
                  ) : (
                    <span className="font-mono text-[10px] tnum">{index + 1}</span>
                  )}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="text-[13px] font-medium text-ink">
                    {step.label}
                  </span>
                  <span className="text-[12px] text-ink-2">{step.detail}</span>
                </span>
              </li>
            );
          })}
        </ol>

        <dl className="grid grid-cols-2 gap-3 rounded-lg border border-line bg-surface-2 p-3.5">
          <div className="flex flex-col gap-0.5">
            <dt className="text-[11px] text-ink-3">Model calls</dt>
            <dd className="text-[15px] font-medium tnum">{total}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-[11px] text-ink-3">Avg latency</dt>
            <dd className="text-[15px] font-medium tnum">
              {formatDuration(snapshot?.averageRuntimeSeconds ?? 0)}
            </dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-[11px] text-ink-3">Failed</dt>
            <dd className="text-[15px] font-medium tnum">
              {snapshot?.failedRuns ?? 0}
            </dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-[11px] text-ink-3">Last call</dt>
            <dd className="text-[15px] font-medium">
              {snapshot?.lastRunAt
                ? formatRelativeTime(snapshot.lastRunAt, new Date())
                : "—"}
            </dd>
          </div>
        </dl>

        <Button
          variant="secondary"
          className="w-full"
          onClick={() => void runNow()}
          disabled={queued}
        >
          {queued ? (
            <LoaderCircle className="animate-spin" />
          ) : (
            <Play />
          )}
          {queued ? "Starting…" : "Generate a post now"}
        </Button>
      </CardContent>
    </Card>
  );
}
