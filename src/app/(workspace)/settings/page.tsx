import type { Metadata } from "next";

import { SettingsView } from "@/features/settings/components/settings-view";

export const metadata: Metadata = {
  title: "Settings",
  description:
    "Brands, review policy, automation cadence and team access for the workspace.",
};

export default function SettingsPage() {
  return <SettingsView />;
}
