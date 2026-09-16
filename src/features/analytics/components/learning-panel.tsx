"use client";

import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  CalendarClock,
  Clock,
  Flame,
  Lightbulb,
  Minus,
  Quote,
  RefreshCw,
  Target,
  TriangleAlert,
} from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useLearning } from "@/hooks/use-insights";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type {
  HookPerformance,
  LearningRecommendation,
  TopicWeight,
  LearningReport,
} from "@/types";

/**
 * The learning engine's output.
 *
 * Everything here is produced by the weekly analysis and persisted; the panel
 * never computes a recommendation itself. That is deliberate — the number shown
 * next to a claim has to be the number the weights were actually derived from,
 * or the whole thing becomes decoration.
 */

const WEEKDAYS_LONG = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const RECOMMENDATION_ICON: Record<LearningRecommendation["kind"], typeof Target> = {
  "best-hook": Quote,
  "best-topic": Target,
  "best-time": Clock,
  "worst-topic": TriangleAlert,
  "next-week": CalendarClock,
  format: Bookmark,
  slide: Lightbulb,
};

function hourLabel(hour: number) {
  return `${String(hour).padStart(2, "0")}:00`;
}

export function LearningPanel() {
  const { state, loading, running, run } = useLearning();
  const [historyOpen, setHistoryOpen] = useState(false);

  const report = state?.latest ?? null;

  return (
    <div className="flex flex-col gap-5">
      {/* Run status */}
      <Card>
        <CardHeader className="flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-1">
            <CardTitle>Weekly analysis</CardTitle>
            {loading ? (
              <Skeleton className="h-4 w-72" />
            ) : report ? (
              <p className="text-[13px] text-ink-2">{report.summary}</p>
            ) : (
              <p className="text-[13px] text-ink-2">
                No analysis has run yet. The Sunday job runs it automatically; you
                can also run it now.
              </p>
            )}
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {report ? (
              <span className="flex flex-col items-end gap-0.5 text-right">
                <span className="text-[11px] text-ink-3">
                  Last run {new Date(report.generatedAt).toLocaleDateString()}
                </span>
                <span className="text-[11px] text-ink-3 tnum">
                  {report.sampleSize} posts · {report.windowDays} days ·{" "}
                  {report.trigger}
                </span>
              </span>
            ) : null}
            <Button
              size="sm"
              variant="secondary"
              disabled={running}
              onClick={() => void run()}
            >
              <RefreshCw className={running ? "animate-spin" : undefined} />
              {running ? "Analysing…" : "Run analysis now"}
            </Button>
          </div>
        </CardHeader>

        {report ? (
          <CardContent className="pt-0">
            <p className="flex items-start gap-2 rounded-lg border border-line bg-surface-2 px-3.5 py-3 text-[12px] leading-relaxed text-ink-2">
              <ArrowRight className="mt-0.5 size-3.5 shrink-0 text-ink-3" />
              <span>
                These weights are read by the generation engine before it picks a
                topic, so a change here changes what gets written next — not just
                what gets reported.
                {state?.updatedAt
                  ? ` Applied since ${new Date(state.updatedAt).toLocaleDateString()}.`
                  : ""}
              </span>
            </p>
          </CardContent>
        ) : null}
      </Card>

      {loading ? (
        <>
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-72 w-full rounded-xl" />
        </>
      ) : report ? (
        <>
          <RecommendationGrid report={report} />
          <TopicWeights weights={report.topicWeights} />
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <HookTable hooks={report.hooks} />
            <TimeTable report={report} />
          </div>
          <NextWeekPlan report={report} />
          {state && state.history.length > 1 ? (
            <HistoryBlock
              open={historyOpen}
              onToggle={() => setHistoryOpen((current) => !current)}
              reports={state.history}
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}

/* ----------------------------- recommendations ----------------------------- */

function RecommendationGrid({ report }: { report: LearningReport }) {
  const ordered = [...report.recommendations].sort(
    (a, b) => b.confidence - a.confidence,
  );

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-medium text-ink">Recommendations</h2>
        <span className="text-[12px] text-ink-3">
          {ordered.length} from {report.sampleSize} posts
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {ordered.map((recommendation) => (
          <RecommendationCard
            key={recommendation.id}
            recommendation={recommendation}
          />
        ))}
      </div>
    </section>
  );
}

function RecommendationCard({
  recommendation,
}: {
  recommendation: LearningRecommendation;
}) {
  const Icon = RECOMMENDATION_ICON[recommendation.kind] ?? Lightbulb;
  const weak = recommendation.confidence < 0.5;

  return (
    <Card className="gap-3 p-5">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border",
            weak ? "border-warning/25 bg-warning-soft text-warning" : "border-line bg-surface-2 text-ink-2",
          )}
        >
          <Icon className="size-4" />
        </span>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <span className="text-[13.5px] font-medium text-ink">
              {recommendation.title}
            </span>
            <Badge tone={weak ? "warning" : "neutral"}>
              {Math.round(recommendation.confidence * 100)}% confidence
            </Badge>
          </div>

          <p className="text-[12.5px] leading-relaxed text-ink-2">
            {recommendation.detail}
          </p>

          <p className="font-mono text-[11px] leading-relaxed text-ink-3">
            {recommendation.evidence}
          </p>

          {recommendation.action ? (
            <Badge tone="outline" className="w-fit">
              <ArrowUpRight />
              {recommendation.action.label}
            </Badge>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------- topic weights ------------------------------ */

function TopicWeights({ weights }: { weights: TopicWeight[] }) {
  if (weights.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-1">
          <CardTitle>Topic weights</CardTitle>
          <p className="text-[13px] text-ink-2">
            Ranked by measured performance. The multiplier is what generation
            applies; the weight is this topic&apos;s share of the whole mix.
          </p>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <ul className="flex flex-col divide-y divide-line">
          {weights.map((topic, index) => (
            <li key={topic.topicId} className="flex flex-col gap-2 py-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2.5">
                  <span className="w-5 shrink-0 font-mono text-[11px] text-ink-3 tnum">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="truncate text-[13.5px] text-ink">
                    {topic.label}
                  </span>
                  <Badge tone="neutral" size="sm">
                    {topic.category}
                  </Badge>
                </span>

                <span className="flex items-center gap-3">
                  <span className="font-mono text-[11.5px] text-ink-3 tnum">
                    {topic.posts} posts
                  </span>
                  <span className="font-mono text-[11.5px] text-ink-3 tnum">
                    {(topic.avgEngagementRate * 100).toFixed(2)}%
                  </span>
                  {topic.trend === "rising" ? (
                    <Badge tone="success" size="sm">
                      <ArrowUpRight />
                      rising
                    </Badge>
                  ) : topic.trend === "falling" ? (
                    <Badge tone="warning" size="sm">
                      <ArrowDownRight />
                      falling
                    </Badge>
                  ) : (
                    <Badge tone="neutral" size="sm">
                      <Minus />
                      steady
                    </Badge>
                  )}
                  <span
                    className={cn(
                      "w-12 shrink-0 text-right font-mono text-[12.5px] tnum",
                      topic.multiplier >= 1 ? "text-ink" : "text-ink-3",
                    )}
                  >
                    {topic.multiplier}×
                  </span>
                </span>
              </div>

              {/* Multiplier bar: 0.5–1.5 centred on 1.0, so "par" is the midpoint. */}
              <div className="flex items-center gap-3 pl-7">
                <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
                  <div
                    className={cn(
                      "absolute inset-y-0 rounded-full",
                      topic.multiplier >= 1 ? "bg-ink" : "bg-ink/35",
                    )}
                    style={{
                      left: `${((Math.min(topic.multiplier, 1) - 0.5) / 1) * 100}%`,
                      width: `${(Math.abs(topic.multiplier - 1) / 1) * 100}%`,
                    }}
                  />
                  <span
                    aria-hidden="true"
                    className="absolute inset-y-0 left-1/2 w-px bg-line-strong"
                  />
                </div>
                <span className="shrink-0 font-mono text-[10.5px] text-ink-3 tnum">
                  {(topic.weight * 100).toFixed(0)}% of mix
                </span>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

/* ---------------------------------- hooks ---------------------------------- */

function HookTable({ hooks }: { hooks: HookPerformance[] }) {
  const max = Math.max(...hooks.map((hook) => hook.weight), 0.0001);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-1">
          <CardTitle>Best hooks</CardTitle>
          <p className="text-[13px] text-ink-2">
            How each opening shape performed. The winner is named in the
            recommendations above and used by next week&apos;s plan.
          </p>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {hooks.length === 0 ? (
          <p className="py-6 text-center text-[12.5px] text-ink-2">
            No hook data in this window.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {hooks.map((hook) => (
              <li key={hook.hookType} className="flex items-center gap-3 py-3">
                <span className="w-24 shrink-0 text-[12.5px] text-ink capitalize">
                  {hook.hookType}
                </span>
                <Progress value={(hook.weight / max) * 100} className="flex-1" />
                <span className="w-16 shrink-0 text-right font-mono text-[11.5px] text-ink-2 tnum">
                  {(hook.avgEngagementRate * 100).toFixed(2)}%
                </span>
                <span className="w-14 shrink-0 text-right font-mono text-[11px] text-ink-3 tnum">
                  {hook.posts} posts
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/* ---------------------------------- times ---------------------------------- */

function TimeTable({ report }: { report: LearningReport }) {
  const usable = report.times.filter((time) => time.posts >= 3).slice(0, 6);
  const max = Math.max(...usable.map((time) => time.score), 0.0001);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-1">
          <CardTitle>Best posting times</CardTitle>
          <p className="text-[13px] text-ink-2">
            Day and hour in UTC, scored on the same composite as the weights.
            Windows with fewer than three posts are left out.
          </p>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {usable.length === 0 ? (
          <p className="py-6 text-center text-[12.5px] text-ink-2">
            Not enough posts per slot to compare windows yet.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {usable.map((time) => (
              <li
                key={`${time.dayOfWeek}-${time.hourUtc}`}
                className="flex items-center gap-3 py-3"
              >
                <span className="w-28 shrink-0 text-[12.5px] text-ink">
                  {WEEKDAYS_LONG[time.dayOfWeek]} {hourLabel(time.hourUtc)}
                </span>
                <Progress value={(time.score / max) * 100} className="flex-1" />
                <span className="w-16 shrink-0 text-right font-mono text-[11.5px] text-ink-2 tnum">
                  {formatNumber(time.avgReach)}
                </span>
                <span className="w-14 shrink-0 text-right font-mono text-[11px] text-ink-3 tnum">
                  {time.posts} posts
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="pt-3 text-[11px] text-ink-3">
          Times are UTC because every stored timestamp is — a local label here
          would be wrong for two of the three brands.
        </p>
      </CardContent>
    </Card>
  );
}

/* --------------------------------- next week -------------------------------- */

function NextWeekPlan({ report }: { report: LearningReport }) {
  if (report.plan.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-1">            <CardTitle>Suggested content for next week</CardTitle>
          <p className="text-[13px] text-ink-2">
            {report.plan.length} slots, sequenced from the strongest topics and
            the best-performing hours — rotating topics so no two days repeat a
            direction.
          </p>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <ol className="flex flex-col divide-y divide-line">
          {report.plan.map((entry) => (
            <li
              key={`${entry.dayOfWeek}-${entry.hourUtc}-${entry.topicId}`}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3.5"
            >
              <span className="flex w-32 shrink-0 flex-col leading-tight">
                <span className="text-[13px] text-ink">
                  {WEEKDAYS_LONG[entry.dayOfWeek]}
                </span>
                <span className="font-mono text-[11px] text-ink-3 tnum">
                  {hourLabel(entry.hourUtc)} UTC
                </span>
              </span>

              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="truncate text-[13px] text-ink">
                  {entry.topicLabel}
                </span>
                <span className="truncate text-[11.5px] text-ink-3">
                  {entry.reason}
                </span>
              </span>

              <Badge tone="outline" className="capitalize">
                <Flame />
                {entry.hookType} hook
              </Badge>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

/* --------------------------------- history --------------------------------- */

function HistoryBlock({
  reports,
  open,
  onToggle,
}: {
  reports: LearningReport[];
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <CardTitle>Report history</CardTitle>
          <p className="text-[13px] text-ink-2">
            Why the weights moved — kept so a change is explainable weeks later.
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={onToggle}>
          {open ? "Hide" : `Show ${reports.length}`}
        </Button>
      </CardHeader>
      {open ? (
        <CardContent className="pt-0">
          <ul className="flex flex-col divide-y divide-line">
            {reports.map((entry) => (
              <li key={entry.id} className="flex items-start gap-3 py-3">
                <span className="w-24 shrink-0 font-mono text-[11px] text-ink-3 tnum">
                  {new Date(entry.generatedAt).toLocaleDateString()}
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[12.5px] text-ink">{entry.summary}</span>
                  <span className="text-[11px] text-ink-3 tnum">
                    {entry.sampleSize} posts · {entry.windowDays} days ·{" "}
                    {entry.trigger}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      ) : null}
    </Card>
  );
}
