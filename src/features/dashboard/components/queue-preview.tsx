"use client";

import { motion } from "framer-motion";
import { Inbox } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";

import { ApprovalButton, RejectButton } from "@/components/content/approval-buttons";
import { AssetPreview } from "@/components/content/asset-preview";
import { QualityMeter } from "@/components/content/quality-meter";
import { FormatTag } from "@/components/content/status-badge";
import { EmptyState } from "@/components/feedback/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { getBrand } from "@/data/brands";
import { MOCK_NOW } from "@/data/time";
import { usePostsActions } from "@/hooks/use-posts";
import { formatRelativeTime } from "@/lib/format";
import { listContainer, listItem } from "@/lib/motion";
import { FORMAT_LABELS } from "@/lib/status";
import { toast } from "@/lib/toast";
import type { Post } from "@/types";

interface QueuePreviewProps {
  items: Post[];
}

export function QueuePreview({ items }: QueuePreviewProps) {
  const { setStatus } = usePostsActions();

  const pending = useMemo(
    () =>
      items
        .filter((item) => item.status === "pending_review")
        .sort((a, b) => Date.parse(a.updatedAt) - Date.parse(b.updatedAt))
        .slice(0, 4),
    [items],
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-1">
          <CardTitle>Awaiting your review</CardTitle>
          <p className="text-[13px] text-ink-2">
            Oldest first — approving here keeps the scheduler unblocked.
          </p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/queue">Open queue</Link>
        </Button>
      </CardHeader>

      <div className="px-3 pb-3">
        {pending.length === 0 ? (
          <EmptyState
            icon={Inbox}
            size="sm"
            title="Nothing waiting for review"
            description="Every draft has a decision. New posts land here automatically."
          />
        ) : (
          <motion.ul
            variants={listContainer}
            initial="hidden"
            animate="visible"
            className="flex flex-col"
          >
            {pending.map((item) => {
              const brand = getBrand(item.brandId);

              return (
                <motion.li
                  key={item.id}
                  variants={listItem}
                  className="flex items-center gap-3.5 rounded-md px-2 py-3 transition-colors duration-150 ease-soft hover:bg-surface-2"
                >
                  <AssetPreview
                    format={item.format}
                    frames={item.assetCount}
                    seed={item.id}
                  />

                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <Link
                      href={`/queue?item=${item.id}`}
                      className="truncate text-[14px] font-medium text-ink hover:underline hover:underline-offset-4"
                    >
                      {item.title}
                    </Link>
                    <span className="flex items-center gap-2 text-[12px] text-ink-3">
                      <Image
                        src={brand.logoSrc}
                        alt=""
                        width={14}
                        height={14}
                        className="size-3.5 rounded-xs"
                      />
                      <span className="truncate">{brand.name}</span>
                      <span aria-hidden="true">·</span>
                      <FormatTag label={FORMAT_LABELS[item.format]} />
                      <span aria-hidden="true">·</span>
                      <QualityMeter score={item.quality.score} bare />
                      <span aria-hidden="true">·</span>
                      <span className="shrink-0">
                        {formatRelativeTime(item.updatedAt, MOCK_NOW)}
                      </span>
                    </span>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <RejectButton
                      size="xs"
                      itemTitle={item.title}
                      label="Reject"
                      onReject={(note) => {
                        void setStatus([item.id], "rejected", { note }).then(() =>
                          toast.warning("Post rejected", { description: item.title }),
                        );
                      }}
                    />
                    <ApprovalButton
                      size="xs"
                      onApprove={() => {
                        void setStatus([item.id], "approved").then(() =>
                          toast.success("Approved", { description: item.title }),
                        );
                      }}
                    />
                  </div>
                </motion.li>
              );
            })}
          </motion.ul>
        )}
      </div>
    </Card>
  );
}
