"use client";

import {
  AtSign,
  Bot,
  Building2,
  Layers,
  Trash,
  TriangleAlert,
  Users,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AiPanel } from "@/features/settings/components/ai-panel";
import { AutomationPanel } from "@/features/settings/components/automation-panel";
import { BrandsPanel } from "@/features/settings/components/brands-panel";
import {
  SettingsSection,
} from "@/features/settings/components/settings-row";
import { InstagramPanel } from "@/features/settings/components/instagram-panel";
import { TeamPanel } from "@/features/settings/components/team-panel";
import { WorkspacePanel } from "@/features/settings/components/workspace-panel";
import { toast } from "@/lib/toast";

const TABS: Array<{ value: string; label: string; icon: LucideIcon }> = [
  { value: "workspace", label: "Workspace", icon: Building2 },
  { value: "brands", label: "Brands", icon: Layers },
  { value: "ai", label: "AI engine", icon: Bot },
  { value: "instagram", label: "Instagram", icon: AtSign },
  { value: "automation", label: "Automation", icon: Zap },
  { value: "team", label: "Team", icon: Users },
];

export function SettingsView() {
  const [resetOpen, setResetOpen] = useState(false);

  return (
    <>
      <PageHeader
        eyebrow="Settings"
        title="Workspace settings"
        description="Brands, review rules, automation, and team access."
      />

      <div className="shell-container pb-10">
        <Tabs defaultValue="workspace" className="flex flex-col gap-5">
          <TabsList className="w-fit">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger key={tab.value} value={tab.value}>
                  <Icon />
                  {tab.label}
                </TabsTrigger>
              );
            })}
          </TabsList>

          <TabsContent value="workspace">
            <WorkspacePanel />
          </TabsContent>
          <TabsContent value="brands">
            <BrandsPanel />
          </TabsContent>
          <TabsContent value="ai">
            <AiPanel />
          </TabsContent>
          <TabsContent value="instagram">
            <InstagramPanel />
          </TabsContent>
          <TabsContent value="automation">
            <AutomationPanel />
          </TabsContent>
          <TabsContent value="team">
            <TeamPanel />
          </TabsContent>
        </Tabs>

        <SettingsSection
          title="Danger zone"
          description="Irreversible actions. These affect every brand in the workspace."
          className="mt-5 border-danger/25"
          footer={
            <Button
              variant="danger"
              size="sm"
              onClick={() => setResetOpen(true)}
            >
              <Trash />
              Reset workspace data
            </Button>
          }
        >
          <div className="flex items-start gap-3 py-4">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-danger" />
            <p className="max-w-xl text-[12.5px] leading-relaxed text-ink-2">
              Resetting clears the mock queue, calendar and activity history.
              Connected Instagram accounts are not affected.
            </p>
          </div>
        </SettingsSection>
      </div>

      <Modal
        open={resetOpen}
        onOpenChange={setResetOpen}
        size="sm"
        title="Reset workspace data?"
        description="This clears every mock item and cannot be undone."
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setResetOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                setResetOpen(false);
                toast.warning("Reset is disabled in the foundation build", {
                  description: "Data layer wiring arrives with the persistence phase.",
                });
              }}
            >
              Reset data
            </Button>
          </>
        }
      />
    </>
  );
}
