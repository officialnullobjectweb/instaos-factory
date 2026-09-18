import type { Metadata } from "next";

import { SettingsView } from "@/features/settings/components/settings-view";
import { APP_NAME } from "@/lib/constants";

export function generateMetadata(): Metadata {
  const title = "Settings";
  const description =
    "Brands, review rules, automation, and team access.";

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

export default function SettingsPage() {
  return <SettingsView />;
}
