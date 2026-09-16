"use client";

import {
  ArrowDownRight,
  ArrowUpRight,
  Bookmark,
  ImageIcon,
  MessageCircle,
  Repeat2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Drawer } from "@/components/ui/drawer";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { getBrand } from "@/data/brands";
import { usePostAnalytics } from "@/hooks/use-insights";
import { formatCompact, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PostAnalytics, SlideRanking } from "@/types";

/**
 * Per-post analytics.
 *
 * Four things this panel insists on getting right, because they are the four
 * that are usually hand-waved:
 *
 * - Completion rate is the last slide's views over the first slide's — not over
 *   the post's reach, which would silently measure something else.
 * - Save, share and comment rates are per *reach*, so they can be compared
 *   between a post with 3k reach and one with 90k.
 * - Best and worst slide are ranked by engagement per 1,000 views, so the
 *   closing slide is not permanently "worst" for being seen less.
 * - Drop-off is measured against the previous slide, which is what names the
 *   slide that actually lost the reader.
 */
export function PostAnalyticsPanel({
  postId,
  open,
  onOpenChange,
}: {
  postId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { analytics, loading, error } = usePostAnalytics(open ? postId : null);

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title={analytics ? analytics.insight.title : "Post analytics"}
      description={
        analytics
          ? `${getBrand(analytics.insight.brandId).name} · published ${new Date(
              analytics.insight.publishedAt,
            ).toLocaleDateString()}`
          : "Per-post performance"
      }
    >
      {loading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-40 w-full rounded-lg" />
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
      ) : error ? (
        <p className="text-[13px] text-ink-2">{error}</p>
      ) : analytics ? (
        <PostAnalyticsBody analytics={analytics} />
      ) : null}
    </Drawer>
  );
}

function PostAnalyticsBody({ analytics }: { analytics: PostAnalytics }) {
  const { insight, totals, ranking } = analytics;
  const brand = getBrand(insight.brandId);
  const maxViews = Math.max(...ranking.map((slide) => slide.views), 1);

  return (
    <div className="flex flex-col gap-6">
      {/* Headline figures */}
      <section className="grid grid-cols-2 gap-3">
        <Figure label="Reach" value={formatCompact(insight.reach)} />
        <Figure
          label="Engagement rate"
          value={`${(totals.engagementRate * 100).toFixed(2)}%`}
        />
        <Figure
          label="Saves"
          value={formatCompact(insight.saves)}
          sub={`${(analytics.saveRate * 100).toFixed(2)}% of reach`}
          icon={Bookmark}
        />
        <Figure
          label="Shares"
          value={formatCompact(insight.shares)}
          sub={`${(analytics.shareRate * 100).toFixed(2)}% of reach`}
          icon={Repeat2}
        />
      </section>

      {/* Completion */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] font-medium tracking-[0.08em] text-ink-3 uppercase">
            Carousel completion
          </span>
          {analytics.completionRate !== null ? (
            <Badge
              tone={analytics.completionRate >= 0.35 ? "success" : "warning"}
            >
              {(analytics.completionRate * 100).toFixed(1)}% reached the last slide
            </Badge>
          ) : (
            <Badge tone="neutral">Single image — no carousel</Badge>
          )}
        </div>

        {analytics.completionRate !== null ? (
          <>
            <Progress
              value={analytics.completionRate * 100}
              aria-label={`${(analytics.completionRate * 100).toFixed(1)} percent reached the last slide`}
            />
            <p className="text-[12px] leading-relaxed text-ink-2">
              {formatCompact(ranking[ranking.length - 1].views)} views on slide{" "}
              {ranking[ranking.length - 1].index} against{" "}
              {formatCompact(ranking[0].views)} on the cover. A carousel that
              holds above 35% is doing well; below 20% the deck is too long for
              what it promises.
            </p>
          </>
        ) : (
          <p className="text-[12px] leading-relaxed text-ink-2">
            This post is a single image, so there is no slide funnel to read.
          </p>
        )}
      </section>

      {/* Slide funnel */}
      {ranking.length > 1 ? (
        <section className="flex flex-col gap-3">
          <span className="text-[11px] font-medium tracking-[0.08em] text-ink-3 uppercase">
            Slide funnel
          </span>
          <ul className="flex flex-col gap-2.5">
            {ranking.map((slide) => (
              <li key={slide.index} className="flex items-center gap-3">
                <span className="w-6 shrink-0 font-mono text-[11px] text-ink-3 tnum">
                  {String(slide.index).padStart(2, "0")}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="font-mono text-[11.5px] text-ink-2 tnum">
                      {formatNumber(slide.views)} views
                    </span>
                    <span className="flex items-center gap-2">
                      {slide.index === analytics.bestSlide?.index ? (
                        <Badge tone="success">
                          <TrendingUp />
                          Best
                        </Badge>
                      ) : null}
                      {slide.index === analytics.worstSlide?.index ? (
                        <Badge tone="warning">
                          <TrendingDown />
                          Weakest
                        </Badge>
                      ) : null}
                    </span>
                  </span>
                  <span className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
                    <span
                      className={cn(
                        "block h-full rounded-full",
                        slide.index === analytics.bestSlide?.index
                          ? "bg-ink"
                          : "bg-ink/45",
                      )}
                      style={{ width: `${Math.max(2, (slide.views / maxViews) * 100)}%` }}
                    />
                  </span>
                </span>
                <span
                  className={cn(
                    "w-14 shrink-0 text-right text-[11.5px] tnum",
                    slide.dropOff > 0.25 ? "text-danger" : "text-ink-3",
                  )}
                  title="Loss against the previous slide"
                >
                  {slide.index === 1 ? "—" : `−${(slide.dropOff * 100).toFixed(0)}%`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Best / worst */}
      {analytics.bestSlide && analytics.worstSlide ? (
        <section className="flex flex-col gap-3">
          <span className="text-[11px] font-medium tracking-[0.08em] text-ink-3 uppercase">
            Strongest and weakest slide
          </span>
          <div className="grid grid-cols-2 gap-3">
            <SlideCard slide={analytics.bestSlide} tone="best" />
            <SlideCard slide={analytics.worstSlide} tone="worst" />
          </div>
          <p className="text-[12px] leading-relaxed text-ink-2">
            Ranked by engagement per 1,000 views, so a slide late in the deck is
            not penalised for being seen less often than the cover.
          </p>
        </section>
      ) : null}

      {/* Totals */}
      <section className="flex flex-col gap-3">
        <span className="text-[11px] font-medium tracking-[0.08em] text-ink-3 uppercase">
          Everything counted
        </span>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-3">
          <Row label="Likes" value={formatCompact(insight.likes)} icon={<MessageCircle />} />
          <Row label="Comments" value={formatCompact(insight.comments)} />
          <Row
            label="Comment rate"
            value={`${(analytics.commentRate * 100).toFixed(3)}%`}
          />
          <Row label="Saves" value={formatCompact(insight.saves)} />
          <Row label="Shares" value={formatCompact(insight.shares)} />
          <Row label="Follows" value={`+${formatNumber(insight.follows)}`} />
          <Row label="Impressions" value={formatCompact(insight.impressions)} />
          <Row label="Profile visits" value={formatCompact(insight.profileVisits)} />
          <Row
            label="Percentile"
            value={`${analytics.categoryPercentile.toFixed(0)}th in ${insight.category}`}
          />
        </dl>
      </section>

      {/* Attribution */}
      <section className="flex flex-col gap-2.5 rounded-lg border border-line bg-surface-2 px-3.5 py-3">
        <span className="text-[11px] font-medium tracking-[0.08em] text-ink-3 uppercase">
          Attribution
        </span>
        <dl className="flex flex-col gap-2">
          <Row label="Topic" value={insight.topicLabel} />
          <Row label="Hook" value={`${insight.hookType} open`} />
          <Row label="Format" value={insight.format} />
          <Row
            label="Published"
            value={`${insight.publishedAt.slice(0, 10)} · ${String(insight.hourUtc).padStart(2, "0")}:00 UTC`}
          />
          <Row label="Brand" value={brand.name} />
        </dl>
        {insight.queuePostId ? (
          <Link
            href={`/queue?item=${insight.queuePostId}`}
            className="mt-1 text-[12px] text-ink-2 underline decoration-line-strong underline-offset-4 transition-colors hover:text-ink"
          >
            Open this post in the queue
          </Link>
        ) : (
          <p className="mt-1 text-[11.5px] leading-relaxed text-ink-3">
            This post has left the working queue, so there is nothing to open —
            the analytics warehouse keeps it, the queue does not.
          </p>
        )}
      </section>
    </div>
  );
}

function SlideCard({ slide, tone }: { slide: SlideRanking; tone: "best" | "worst" }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 rounded-lg border px-3.5 py-3",
        tone === "best" ? "border-success/25 bg-success-soft" : "border-warning/25 bg-warning-soft",
      )}
    >
      <span className="flex items-center gap-1.5 text-[11px] tracking-[0.06em] uppercase">
        {tone === "best" ? (
          <ArrowUpRight className="size-3.5 text-success" />
        ) : (
          <ArrowDownRight className="size-3.5 text-warning" />
        )}
        <span className="text-ink-2">Slide {slide.index}</span>
      </span>
      <span className="text-[20px] leading-none font-medium text-ink tnum">
        {slide.engagementPerMille.toFixed(1)}
      </span>
      <span className="text-[11px] text-ink-3">
        engagements per 1,000 views · {formatCompact(slide.saves)} saves
      </span>
    </div>
  );
}

function Figure({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: typeof ImageIcon;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-line px-3.5 py-3">
      <span className="flex items-center gap-1.5 text-[11px] tracking-[0.06em] text-ink-3 uppercase">
        {Icon ? <Icon className="size-3.5" /> : null}
        {label}
      </span>
      <span className="text-[22px] leading-none font-medium text-ink tnum">
        {value}
      </span>
      {sub ? <span className="text-[11px] text-ink-3 tnum">{sub}</span> : null}
    </div>
  );
}

function Row({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="flex items-center gap-1.5 text-[12px] text-ink-3">
        {icon ? <span className="[&_svg]:size-3.5">{icon}</span> : null}
        {label}
      </dt>
      <dd className="text-[12.5px] text-ink tnum">{value}</dd>
    </div>
  );
}
