"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Download, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";

import { EmptyState } from "@/components/feedback/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BrandComparison } from "@/features/analytics/components/brand-comparison";
import {
  GRANULARITY_OPTIONS,
  InsightChartGrid,
  InsightMetricGrid,
  SegmentedControl,
  WINDOW_OPTIONS,
} from "@/features/analytics/components/insights-dashboard";
import { LearningPanel } from "@/features/analytics/components/learning-panel";
import { PostAnalyticsPanel } from "@/features/analytics/components/post-analytics-panel";
import { PublishHistory } from "@/features/analytics/components/publish-history";
import { useInsights } from "@/hooks/use-insights";
import { getBrand } from "@/data/brands";
import { fadeIn } from "@/lib/motion";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type { Granularity } from "@/types";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "brands", label: "Brands" },
  { id: "content", label: "Post detail" },
  { id: "learning", label: "Learning" },
  { id: "publishing", label: "Publishing" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function AnalyticsView() {
  const [tab, setTab] = useState<TabId>("overview");
  const [days, setDays] = useState<number>(7);
  const [granularity, setGranularity] = useState<Granularity>("daily");
  const [openPost, setOpenPost] = useState<string | null>(null);

  const { data, loading } = useInsights(days, granularity);

  const windowLabel =
    WINDOW_OPTIONS.find((option) => option.days === days)?.label ?? `${days} days`;

  return (
    <>
      <PageHeader
        eyebrow="Analytics"
        title="Performance across three brands"
        description="Derived from the insights rollup and the per-post records — the same tables the weekly analysis reads, so a recommendation and the number behind it cannot disagree."
        actions={
          <Button
            variant="secondary"
            onClick={() =>
              toast.success("Report queued", {
                description: "A CSV export will be emailed when the export job runs.",
              })
            }
          >
            <Download />
            Export report
          </Button>
        }
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <div
              role="tablist"
              aria-label="Analytics views"
              className="flex w-fit items-center gap-1 rounded-full border border-line bg-surface p-1"
            >
              {TABS.map((entry) => {
                const active = tab === entry.id;
                return (
                  <button
                    key={entry.id}
                    type="button"
                    role="tab"
                    id={`analytics-tab-${entry.id}`}
                    aria-selected={active}
                    aria-controls={`analytics-panel-${entry.id}`}
                    onClick={() => setTab(entry.id)}
                    className={cn(
                      "rounded-full px-3.5 py-1.5 text-[12.5px] font-medium transition-colors duration-150 ease-soft",
                      active
                        ? "bg-ink text-canvas"
                        : "text-ink-2 hover:bg-surface-2 hover:text-ink",
                    )}
                  >
                    {entry.label}
                  </button>
                );
              })}
            </div>

            {/* The window and granularity shape every panel, so they sit next to
                the tabs rather than inside one of them. */}
            {tab === "overview" || tab === "brands" || tab === "content" ? (
              <div className="flex flex-wrap items-center gap-2">
                <SegmentedControl
                  label="Time window"
                  options={WINDOW_OPTIONS.map((option) => ({
                    id: option.days,
                    label: option.label,
                  }))}
                  value={days}
                  onChange={setDays}
                />
                <SegmentedControl
                  label="Chart granularity"
                  options={GRANULARITY_OPTIONS}
                  value={granularity}
                  onChange={setGranularity}
                />
              </div>
            ) : null}
          </div>
        }
      />

      <div className="shell-container flex flex-col gap-5 pb-8">
        {tab !== "learning" && tab !== "publishing" ? (
          <InsightMetricGrid
            totals={data?.totals ?? emptyTotals()}
            previousTotals={data?.previousTotals ?? emptyTotals()}
            series={data?.series ?? []}
            loading={loading && !data}
          />
        ) : null}

        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            role="tabpanel"
            id={`analytics-panel-${tab}`}
            aria-labelledby={`analytics-tab-${tab}`}
            variants={fadeIn}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="flex flex-col gap-5"
          >
            {tab === "overview" ? (
              data?.empty ? (
                <EmptyState
                  icon={TrendingUp}
                  title="No insights data yet"
                  description="Run scripts/seed-insights.mjs to generate the warehouse, or connect the Insights sync."
                />
              ) : (
                <InsightChartGrid
                  series={data?.series ?? []}
                  granularity={granularity}
                  loading={loading && !data}
                />
              )
            ) : null}

            {tab === "brands" ? (
              <BrandComparison
                brands={data?.byBrand ?? []}
                seriesByBrand={data?.seriesByBrand ?? []}
                loading={loading && !data}
              />
            ) : null}

            {tab === "content" ? (
              <TopPostsPanel
                posts={data?.topPosts ?? []}
                loading={loading && !data}
                windowLabel={windowLabel}
                onOpen={setOpenPost}
              />
            ) : null}

            {tab === "learning" ? <LearningPanel /> : null}
            {tab === "publishing" ? <PublishHistory /> : null}
          </motion.div>
        </AnimatePresence>
      </div>

      <PostAnalyticsPanel
        postId={openPost}
        open={openPost !== null}
        onOpenChange={(open) => {
          if (!open) setOpenPost(null);
        }}
      />
    </>
  );
}

/* --------------------------------- content --------------------------------- */

function TopPostsPanel({
  posts,
  loading,
  windowLabel,
  onOpen,
}: {
  posts: import("@/types").PostInsight[];
  loading: boolean;
  windowLabel: string;
  onOpen: (postId: string) => void;
}) {
  const ranked = useMemo(
    () =>
      posts.map((post) => {
        const interactions = post.likes + post.comments + post.shares + post.saves;
        return {
          post,
          engagementRate: post.reach > 0 ? interactions / post.reach : 0,
          saveRate: post.reach > 0 ? post.saves / post.reach : 0,
          shareRate: post.reach > 0 ? post.shares / post.reach : 0,
        };
      }),
    [posts],
  );

  if (loading) return <Skeleton className="h-80 w-full rounded-xl" />;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-1">
          <CardTitle>Top performing posts</CardTitle>
          <p className="text-[13px] text-ink-2">
            Published in the last {windowLabel.toLowerCase()}. Open any post for
            carousel completion, save and share rates, and its best and worst
            slide.
          </p>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {ranked.length === 0 ? (
          <EmptyState
            icon={TrendingUp}
            size="sm"
            title="Nothing published in this window"
            description="Pick a longer window, or publish from the queue."
          />
        ) : (
          <div className="-mx-5 overflow-x-auto px-5">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <caption className="sr-only">
                Posts published in the window, ranked by composite score
              </caption>
              <thead>
                <tr className="border-b border-line">
                  {["Post", "Topic", "Reach", "Engagement", "Saves", "Shares", ""].map(
                    (heading) => (
                      <th
                        key={heading}
                        scope="col"
                        className="pb-2.5 pr-4 text-[11px] font-medium tracking-[0.06em] text-ink-3 uppercase last:pr-0"
                      >
                        {heading}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {ranked.map((row, index) => (
                  <tr
                    key={row.post.postId}
                    className="border-b border-line last:border-0"
                  >
                    <th scope="row" className="max-w-[280px] py-3 pr-4 font-normal">
                      <span className="flex items-center gap-2.5">
                        <span className="w-5 shrink-0 font-mono text-[11px] text-ink-3 tnum">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <span className="flex min-w-0 flex-col leading-tight">
                          <span className="truncate text-[13px] font-medium text-ink">
                            {row.post.title}
                          </span>
                          <span className="truncate text-[11px] text-ink-3">
                            {getBrand(row.post.brandId).name} ·{" "}
                            {new Date(row.post.publishedAt).toLocaleDateString()}
                          </span>
                        </span>
                      </span>
                    </th>
                    <td className="py-3 pr-4">
                      <span className="flex flex-col gap-1">
                        <span className="text-[12.5px] text-ink-2">
                          {row.post.topicLabel}
                        </span>
                        <Badge tone="outline" className="w-fit capitalize">
                          {row.post.hookType}
                        </Badge>
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-[13px] tnum">
                      {new Intl.NumberFormat("en-US", {
                        notation: "compact",
                        maximumFractionDigits: 1,
                      }).format(row.post.reach)}
                    </td>
                    <td className="py-3 pr-4 text-[13px] tnum">
                      {(row.engagementRate * 100).toFixed(2)}%
                    </td>
                    <td className="py-3 pr-4 text-[13px] tnum">
                      {(row.saveRate * 100).toFixed(2)}%
                    </td>
                    <td className="py-3 pr-4 text-[13px] tnum">
                      {(row.shareRate * 100).toFixed(2)}%
                    </td>
                    <td className="py-3 text-right">
                      <Button
                        size="xs"
                        variant="secondary"
                        onClick={() => onOpen(row.post.queuePostId ?? row.post.postId)}
                      >
                        Analytics
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="pt-3 text-[11px] text-ink-3">
          Ranked on the same composite the learning engine uses: engagement rate,
          save rate and share rate, with reach as a damped tiebreaker. A post is
          only listed while it is inside the selected window.
        </p>
      </CardContent>
    </Card>
  );
}

function emptyTotals(): import("@/types").InsightTotals {
  return {
    reach: 0,
    impressions: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    saves: 0,
    follows: 0,
    profileVisits: 0,
    engagementRate: 0,
    saveRate: 0,
    shareRate: 0,
    publishedPosts: 0,
  };
}
