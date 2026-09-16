import type { Metadata } from "next";

import { DashboardView } from "@/features/dashboard/components/dashboard-view";

export const metadata: Metadata = {
  title: "Dashboard",
  description:
    "Everything waiting on you across all three Instagram brands, in one view.",
};

export default function DashboardPage() {
  return <DashboardView />;
}
