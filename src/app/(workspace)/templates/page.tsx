import type { Metadata } from "next";

import { TemplatesView } from "@/features/templates/components/templates-view";
import { APP_NAME } from "@/lib/constants";

export function generateMetadata(): Metadata {
  const title = "Templates";
  const description =
    "Reusable layout, pacing and typography systems per brand.";

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

export default function TemplatesPage() {
  return <TemplatesView />;
}
