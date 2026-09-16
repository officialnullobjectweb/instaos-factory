"use client";

import {
  CalendarClock,
  CirclePlus,
  Download,
  RefreshCw,
  Upload,
  UserPlus,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/lib/toast";
import { useUIStore } from "@/store/ui-store";

interface QuickAction {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  /** Actions with a form open a modal; `generate` opens the real engine. */
  form?: "invite" | "upload";
  /** Opens the generation dialog instead of a modal. */
  generate?: boolean;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: "generate",
    label: "Generate content",
    description: "Run the AI pipeline for one brand",
    icon: CirclePlus,
    generate: true,
  },
  {
    id: "upload",
    label: "Upload assets",
    description: "Add renders to the asset pipeline",
    icon: Upload,
    form: "upload",
  },
  {
    id: "invite",
    label: "Invite reviewer",
    description: "Give a teammate approval rights",
    icon: UserPlus,
    form: "invite",
  },
  {
    id: "sync",
    label: "Sync metrics",
    description: "Refresh insights from Instagram",
    icon: RefreshCw,
  },
  {
    id: "slots",
    label: "Plan slots",
    description: "Auto-fill the coming week",
    icon: CalendarClock,
  },
  {
    id: "export",
    label: "Export report",
    description: "Weekly CSV across all brands",
    icon: Download,
  },
];

export function QuickActions() {
  const setGenerateOpen = useUIStore((state) => state.setGenerateOpen);
  const [active, setActive] = useState<QuickAction | null>(null);

  function run(action: QuickAction) {
    if (action.generate) {
      setGenerateOpen(true);
      return;
    }
    if (action.form) {
      setActive(action);
      return;
    }
    toast.success(`${action.label} queued`, {
      description: "This action connects to the automation service in the next phase.",
    });
  }

  function submit() {
    if (!active) return;
    toast.success(active.form === "invite" ? "Invitation sent" : "Upload queued", {
      description: active.description,
    });
    setActive(null);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-1">
          <CardTitle>Quick actions</CardTitle>
          <p className="text-[13px] text-ink-2">The six moves made most often.</p>
        </div>
      </CardHeader>

      <CardContent className="grid grid-cols-1 gap-2 pt-0 sm:grid-cols-2">
        {QUICK_ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.id}
              type="button"
              onClick={() => run(action)}
              className="flex flex-col items-start gap-1.5 rounded-lg border border-line bg-surface-2 px-3.5 py-3 text-left transition-colors duration-150 ease-soft hover:bg-surface-3 active:scale-[0.995] motion-reduce:active:scale-100"
            >
              <Icon className="size-4 text-ink-2" />
              <span className="text-[13px] font-medium text-ink">{action.label}</span>
              <span className="text-[11.5px] leading-snug text-ink-2">
                {action.description}
              </span>
            </button>
          );
        })}
      </CardContent>

      <Modal
        open={active !== null}
        onOpenChange={(open) => (open ? null : setActive(null))}
        size="sm"
        title={active?.label ?? ""}
        description={active?.description}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setActive(null)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={submit}>
              Confirm
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3 pb-2">
          {active?.form === "invite" ? (
            <>
              <Label htmlFor="reviewer-email">Reviewer email</Label>
              <Input
                id="reviewer-email"
                type="email"
                placeholder="teammate@studio.com"
              />
            </>
          ) : null}

          {active?.form === "upload" ? (
            <>
              <Label htmlFor="asset-name">Asset batch name</Label>
              <Input id="asset-name" placeholder="SS26 linen shoot — selects" />
            </>
          ) : null}
        </div>
      </Modal>
    </Card>
  );
}
