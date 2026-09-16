"use client";

import { Inbox, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { getBrand } from "@/data/brands";
import { AiLogs } from "@/features/dashboard/components/ai-logs";
import { AutomationStatus } from "@/features/dashboard/components/automation-status";
import { CalendarPreview } from "@/features/dashboard/components/calendar-preview";
import { QueuePreview } from "@/features/dashboard/components/queue-preview";
import { QuickActions } from "@/features/dashboard/components/quick-actions";
import { RecentActivity } from "@/features/dashboard/components/recent-activity";
import { StatRow } from "@/features/dashboard/components/stat-row";
import { SystemHealth } from "@/features/dashboard/components/system-health";
import { useBrandScope, useScopedPosts } from "@/hooks/use-scope";
import { summariseQueue } from "@/lib/metrics";
import { toast } from "@/lib/toast";
import { CURRENT_USER } from "@/components/layout/user-menu";
import { formatNumber } from "@/lib/format";

/**
 * Live date label for the header. Client-rendered after mount so the server
 * and client never disagree about what "today" is.
 */
function useTodayLabel() {
  const [label, setLabel] = useState("");
  useEffect(() => {
    setLabel(
      new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      }).format(new Date()),
    );
  }, []);
  return label;
}

/**
 * Greeting part of the day, computed live on the client for the same reason.
 */
function useGreeting() {
  const [greeting, setGreeting] = useState("");
  useEffect(() => {
    const hour = new Date().getHours();
    setGreeting(
      hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening",
    );
  }, []);
  return greeting;
}

export function DashboardView() {
  const items = useScopedPosts();
  const { brandId } = useBrandScope();
  const todayLabel = useTodayLabel();
  const greeting = useGreeting();

  const summary = useMemo(() => summariseQueue(items), [items]);
  const brand = brandId === "all" ? null : getBrand(brandId);

  const description = brand
    ? `${brand.name} · ${brand.positioning} · ${formatNumber(brand.followers)} followers`
    : "Three brands, one queue. Review what is waiting, then let the scheduler publish.";

  return (
    <>
      <PageHeader
        eyebrow={todayLabel}
        title={greeting ? `${greeting}, ${CURRENT_USER.name}` : CURRENT_USER.name}
        description={description}
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() =>
                toast.info("Metrics come from the insights sync", {
                  description:
                    "Connect Instagram Insights (Graph API media insights) to pull live reach and engagement.",
                })
              }
            >
              <RefreshCw />
              Sync metrics
            </Button>
            <Button variant="primary" asChild>
              <Link href="/queue">
                <Inbox />
                Review queue
                <span className="tnum">{summary.pendingReview}</span>
              </Link>
            </Button>
          </>
        }
      />

      <div className="shell-container flex flex-col gap-5 pb-6">
        <StatRow summary={summary} />

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
          <div className="xl:col-span-8">
            <QueuePreview items={items} />
          </div>
          <div className="xl:col-span-4">
            <AutomationStatus />
          </div>

          <div className="xl:col-span-8">
            <RecentActivity brandId={brandId} />
          </div>
          <div className="xl:col-span-4">
            <CalendarPreview items={items} />
          </div>

        </div>

        <Section
          title="Operate"
          description="Automation, planning and system state for the whole workspace."
          className="pt-1"
        >
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
            <div className="xl:col-span-8">
              <QuickActions />
            </div>
            <div className="xl:col-span-4">
              <SystemHealth />
            </div>
            <div className="xl:col-span-12">
              <AiLogs />
            </div>
          </div>
        </Section>
      </div>
    </>
  );
}
