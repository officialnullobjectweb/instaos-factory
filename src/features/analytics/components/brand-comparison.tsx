"use client";

import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import Image from "next/image";

import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getBrand } from "@/data/brands";
import { formatCompact, formatNumber, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { BrandInsightSummary, InsightPoint } from "@/types";

/**
 * Brand comparison.
 *
 * The bars are scaled to the largest reach in the set rather than to the total,
 * so the leader fills the row and the comparison is between brands rather than
 * against an invisible maximum. `reachPerPost` is shown alongside raw reach
 * because a brand that published three times as much is not three times as
 * effective.
 */
export function BrandComparison({
  brands,
  seriesByBrand,
  loading,
}: {
  brands: BrandInsightSummary[];
  seriesByBrand: Array<{ brandId: string; points: InsightPoint[] }>;
  loading: boolean;
}) {
  if (loading) {
    return <Skeleton className="h-[360px] w-full rounded-xl" />;
  }

  if (brands.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Brand comparison</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="py-8 text-center text-[13px] text-ink-2">
            No brand has published in this window.
          </p>
        </CardContent>
      </Card>
    );
  }

  const maxReach = Math.max(...brands.map((brand) => brand.reach), 1);

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-1">
            <CardTitle>Brand comparison</CardTitle>
            <p className="text-[13px] text-ink-2">
              Reach, engagement and follower growth per publishing account, in
              the selected window.
            </p>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <ul className="flex flex-col divide-y divide-line">
            {brands.map((row) => {
              const brand = getBrand(row.brandId);
              const points =
                seriesByBrand.find((entry) => entry.brandId === row.brandId)
                  ?.points ?? [];
              const growthPositive = row.followerGrowth >= 0;

              return (
                <li key={row.brandId} className="flex flex-col gap-3 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-3">
                      <Image
                        src={brand.logoSrc}
                        alt=""
                        width={24}
                        height={24}
                        className="size-6 shrink-0 rounded-xs"
                      />
                      <span className="flex min-w-0 flex-col leading-tight">
                        <span className="truncate text-[13.5px] font-medium text-ink">
                          {brand.name}
                        </span>
                        <span className="truncate text-[11.5px] text-ink-3">
                          {brand.handle} · {row.publishedPosts}{" "}
                          {row.publishedPosts === 1 ? "post" : "posts"}
                        </span>
                      </span>
                    </span>

                    <span className="flex flex-wrap items-center gap-x-5 gap-y-1">
                      <Stat label="Reach" value={formatCompact(row.reach)} />
                      <Stat
                        label="Per post"
                        value={formatCompact(row.reachPerPost)}
                      />
                      <Stat
                        label="Engagement"
                        value={`${(row.engagementRate * 100).toFixed(2)}%`}
                      />
                      <Stat
                        label="Save rate"
                        value={`${(row.saveRate * 100).toFixed(2)}%`}
                      />
                      <span className="flex flex-col gap-0.5">
                        <span className="text-[10.5px] tracking-[0.06em] text-ink-3 uppercase">
                          Followers
                        </span>
                        <span
                          className={cn(
                            "flex items-center gap-1 text-[12.5px] tnum",
                            growthPositive ? "text-success" : "text-danger",
                          )}
                        >
                          {growthPositive ? (
                            <ArrowUpRight className="size-3.5" />
                          ) : (
                            <ArrowDownRight className="size-3.5" />
                          )}
                          {growthPositive ? "+" : "−"}
                          {formatNumber(Math.abs(row.followerGrowth))}
                        </span>
                      </span>
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div
                      className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3"
                      role="img"
                      aria-label={`${brand.name} reach ${formatNumber(row.reach)}`}
                    >
                      <div
                        className="h-full rounded-full bg-ink"
                        style={{ width: `${Math.max(2, (row.reach / maxReach) * 100)}%` }}
                      />
                    </div>
                    {points.length > 1 ? (
                      <span className="shrink-0 font-mono text-[10.5px] text-ink-3 tnum">
                        {formatPercent(
                          points[points.length - 1].reach - points[0].reach,
                          { signed: true },
                        )}
                      </span>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex flex-col gap-0.5">
      <span className="text-[10.5px] tracking-[0.06em] text-ink-3 uppercase">
        {label}
      </span>
      <span className="text-[12.5px] text-ink tnum">{value}</span>
    </span>
  );
}
