import type { Metadata } from "next";

import { ScheduleView } from "@/features/schedule/components/schedule-view";
import { APP_NAME } from "@/lib/constants";

export function generateMetadata(): Metadata {
  const title = "Schedule";
  const description =
    "The publishing calendar for every brand, with slots already approved.";

  return {
    title,
    description,
    openGraph: {
      title: `${title} · ${APP_NAME}`,
      description,
      images: [
        {
          url: `/api/og?title=${encodeURIComponent(title)}&subtitle=${encodeURIComponent(description)}`,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
      type: "website",
      siteName: APP_NAME,
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} · ${APP_NAME}`,
      description,
      images: [
        `/api/og?title=${encodeURIComponent(title)}&subtitle=${encodeURIComponent(description)}`,
      ],
    },
  };
}

export default function SchedulePage() {
  return <ScheduleView />;
}
