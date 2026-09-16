"use client";

import { useState } from "react";

import { CurrentUserChip } from "@/components/layout/user-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OptionCards } from "@/components/ui/option-cards";
import { Switch } from "@/components/ui/switch";
import {
  SettingsRow,
  SettingsSection,
} from "@/features/settings/components/settings-row";
import { SIDEBAR_MODE_META, SIDEBAR_MODE_ORDER } from "@/lib/constants";
import { toast } from "@/lib/toast";
import { useSidebar } from "@/providers/sidebar-provider";
import { useUIStore, type Density } from "@/store/ui-store";

const TIMEZONES = [
  { value: "utc", label: "UTC" },
  { value: "america/new_york", label: "New York (ET)" },
  { value: "europe/london", label: "London (GMT)" },
  { value: "asia/tokyo", label: "Tokyo (JST)" },
];

export function WorkspacePanel() {
  const density = useUIStore((state) => state.density);
  const setDensity = useUIStore((state) => state.setDensity);
  const { mode: sidebarMode, setMode: setSidebarMode } = useSidebar();

  const [name, setName] = useState("Instagram Factory OS");
  const [timezone, setTimezone] = useState("utc");
  const [requireTwoApprovals, setRequireTwoApprovals] = useState(true);
  const [autoSchedule, setAutoSchedule] = useState(true);

  return (
    <div className="flex flex-col gap-5">
      <SettingsSection
        title="Workspace"
        description="How the workspace identifies itself and when the team works."
        footer={
          <Button
            variant="primary"
            size="sm"
            onClick={() =>
              toast.success("Workspace saved", { description: name })
            }
          >
            Save changes
          </Button>
        }
      >
        <SettingsRow
          title="Workspace name"
          description="Shown in the sidebar, browser tab and exported reports."
        >
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="w-full sm:w-64"
            aria-label="Workspace name"
          />
        </SettingsRow>

        <SettingsRow
          title="Reporting timezone"
          description="All scheduled slots and daily rollups use this timezone."
        >
          <Select value={timezone} onValueChange={setTimezone}>
            <SelectTrigger className="w-full sm:w-56" aria-label="Reporting timezone">
              <SelectValue>
                {TIMEZONES.find((zone) => zone.value === timezone)?.label ?? "UTC"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {TIMEZONES.map((zone) => (
                <SelectItem key={zone.value} value={zone.value}>
                  {zone.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingsRow>

        <SettingsRow
          title="Interface density"
          description="Compact reduces padding in lists for more rows per screen."
        >
          <div className="flex items-center gap-2">
            <Label htmlFor="density" className="text-ink-2">
              Compact
            </Label>
            <Switch
              id="density"
              checked={density === "compact"}
              onCheckedChange={(checked) =>
                setDensity((checked ? "compact" : "comfortable") as Density)
              }
            />
          </div>
        </SettingsRow>
      </SettingsSection>

      <SettingsSection
        title="Sidebar"
        description="Three behaviours, remembered per browser. ⌘B cycles through them from anywhere."
      >
        <SettingsRow
          title="Sidebar behaviour"
          description="Choose how the navigation rail presents itself while you work."
          stacked
          className="last:pb-4"
        >
          <OptionCards
            label="Sidebar behaviour"
            value={sidebarMode}
            onValueChange={setSidebarMode}
            options={SIDEBAR_MODE_ORDER.map((mode) => ({
              value: mode,
              label: SIDEBAR_MODE_META[mode].label,
              description: SIDEBAR_MODE_META[mode].description,
            }))}
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection
        title="Review policy"
        description="Guardrails applied before anything reaches the scheduler."
        footer={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => toast.success("Review policy updated")}
          >
            Update policy
          </Button>
        }
      >
        <SettingsRow
          title="Require two approvals"
          description="High-priority items need a second reviewer before scheduling."
        >
          <Switch
            checked={requireTwoApprovals}
            onCheckedChange={setRequireTwoApprovals}
            aria-label="Require two approvals"
          />
        </SettingsRow>

        <SettingsRow
          title="Auto-schedule approved content"
          description="Approved items are placed in the next open slot automatically."
        >
          <Switch
            checked={autoSchedule}
            onCheckedChange={setAutoSchedule}
            aria-label="Auto-schedule approved content"
          />
        </SettingsRow>

        <SettingsRow
          title="Signed in as"
          description="Owner of this workspace, with full approval rights."
          className="last:pb-4"
        >
          <CurrentUserChip />
        </SettingsRow>
      </SettingsSection>
    </div>
  );
}
