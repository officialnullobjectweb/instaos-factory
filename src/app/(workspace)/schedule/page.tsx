import type { Metadata } from "next";

import { ScheduleView } from "@/features/schedule/components/schedule-view";

export const metadata: Metadata = {
  title: "Schedule",
  description:
    "The publishing calendar for every brand, with slots already approved.",
};

export default function SchedulePage() {
  return <ScheduleView />;
}
