"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

import { StatusBadge } from "@/components/content/status-badge";
import { EmptyState } from "@/components/feedback/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getBrand } from "@/data/brands";
import { useAllPosts } from "@/hooks/use-posts";
import { formatCompact } from "@/lib/format";
import type { Post } from "@/types";

/** Reach is only recorded once a post is live, so the ranking is published-only. */
function rankedByReach(posts: Post[]) {
  return posts
    .filter((post): post is Post & { metrics: NonNullable<Post["metrics"]> } =>
      Boolean(post.metrics),
    )
    .sort((a, b) => b.metrics.reach - a.metrics.reach)
    .slice(0, 5);
}

export function TopContent() {
  const posts = useAllPosts();
  const rows = useMemo(() => rankedByReach(posts), [posts]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-1">
          <CardTitle>Top performing content</CardTitle>
          <p className="text-[13px] text-ink-2">
            Ranked by reach across the last 7 days.
          </p>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {rows.length === 0 ? (
          <EmptyState
            icon={ArrowUpRight}
            size="sm"
            title="Nothing published yet"
            description="Reach appears here once the first post goes live."
          />
        ) : (
          <ol className="flex flex-col divide-y divide-line">
            {rows.map((post, index) => {
              const brand = getBrand(post.brandId);

              return (
                <li key={post.id} className="flex items-center gap-4 py-3.5">
                  <span className="w-5 shrink-0 font-mono text-[11px] text-ink-3 tnum">
                    {(index + 1).toString().padStart(2, "0")}
                  </span>

                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <Link
                      href={`/queue?item=${post.id}`}
                      className="flex items-center gap-1 truncate text-[13.5px] font-medium text-ink hover:underline hover:underline-offset-4"
                    >
                      {post.title}
                      <ArrowUpRight className="size-3.5 shrink-0 text-ink-3" />
                    </Link>
                    <span className="text-[11.5px] text-ink-3">
                      {brand.name} · saves {formatCompact(post.metrics.saves)}
                    </span>
                  </span>

                  <span className="shrink-0 text-[13.5px] tnum">
                    {formatCompact(post.metrics.reach)}
                  </span>

                  <StatusBadge status={post.status} size="sm" withIcon={false} />
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
