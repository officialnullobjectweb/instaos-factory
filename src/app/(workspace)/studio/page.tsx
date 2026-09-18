import type { Metadata } from "next";

import { StudioView } from "@/features/studio/components/studio-view";
import { APP_NAME } from "@/lib/constants";

export function generateMetadata(): Metadata {
  const title = "Design Studio";
  const description = "Edit slides, adjust layout, export as PNG/PDF.";

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

export default function StudioPage() {
  return <StudioView />;
}
