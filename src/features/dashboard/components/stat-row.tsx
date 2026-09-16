"use client";

import { CircleCheck, Inbox, Radio, Send } from "lucide-react";

import { MetricCard } from "@/components/content/metric-card";
import { Progress } from "@/components/ui/progress";
import type { QueueSummary } from "@/lib/metrics";

interface StatRowProps {
  summary: QueueSummary;
}

export function StatRow({ summary }: StatRowProps) {
  const reviewShare =
    summary.total === 0
      ? 0
      : Math.round((summary.pendingReview / summary.total) * 100);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        label="Pending review"
        value={summary.pendingReview}
        icon={Inbox}
        href="/queue"
        hint={`${summary.awaitingSlot} approved awaiting a slot`}
        footer={
          <div className="flex flex-col gap-2">
            <Progress
              value={reviewShare}
              aria-label={`${reviewShare}% of the queue is waiting on review`}
            />
            <span className="text-[11px] text-ink-3 tnum">
              {reviewShare}% of all content needs a decision
            </span>
          </div>
        }
      />

      <MetricCard
        label="Approved"
        value={summary.approved}
        icon={CircleCheck}
        href="/queue"
        hint="Ready for the scheduler"
      />

      <MetricCard
        label="Scheduled"
        value={summary.scheduled}
        icon={Send}
        href="/schedule"
        hint="Locked into publishing slots"
      />

      <MetricCard
        label="Published today"
        value={summary.publishedToday}
        icon={Radio}
        href="/analytics"
        hint="Live on Instagram"
      />
    </div>
  );
}
