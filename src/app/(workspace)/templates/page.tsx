import type { Metadata } from "next";

import { TemplatesView } from "@/features/templates/components/templates-view";

export const metadata: Metadata = {
  title: "Templates",
  description: "Reusable layout, pacing and typography systems per brand.",
};

export default function TemplatesPage() {
  return <TemplatesView />;
}
