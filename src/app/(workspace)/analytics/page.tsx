import type { Metadata } from "next";

import { AnalyticsView } from "@/features/analytics/components/analytics-view";

export const metadata: Metadata = {
  title: "Analytics",
  description: "Reach, engagement and follower growth across all three brands.",
};

export default function AnalyticsPage() {
  return <AnalyticsView />;
}
