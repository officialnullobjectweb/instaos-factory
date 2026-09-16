import type { Metadata } from "next";

import { QueueView } from "@/features/queue/components/queue-view";

export const metadata: Metadata = {
  title: "Content Queue",
  description:
    "Review AI-generated posts, edit them in place, compare versions and approve them for publishing.",
};

export default function QueuePage() {
  return <QueueView />;
}
