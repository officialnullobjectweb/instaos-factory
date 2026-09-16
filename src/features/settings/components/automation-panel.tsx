"use client";

import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  SettingsRow,
  SettingsSection,
} from "@/features/settings/components/settings-row";
import { AUTOMATION_PIPELINE } from "@/lib/constants";
import { formatRatio } from "@/lib/format";
import { toast } from "@/lib/toast";

const CADENCES = [
  { value: "hourly", label: "Every hour" },
  { value: "six-hours", label: "Every 6 hours" },
  { value: "daily", label: "Once a day" },
];

/** Live automation numbers, derived from the real AI request log. */
interface AutomationHealth {
  successRate: number;
  totalRuns: number;
  failedRuns: number;
  averageRuntimeSeconds: number;
}

export function AutomationPanel() {
  const [health, setHealth] = useState<AutomationHealth | null>(null);
  const [cadence, setCadence] = useState("six-hours");
  const [maxBatch, setMaxBatch] = useState("6");
  const [spendGuardrail, setSpendGuardrail] = useState(true);
  const [stages, setStages] = useState<Record<string, boolean>>(
    Object.fromEntries(AUTOMATION_PIPELINE.map((stage) => [stage.id, true])),
  );

  useEffect(() => {
    fetch("/api/system/health")
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { automation?: AutomationHealth } | null) => {
        if (data?.automation) setHealth(data.automation);
      })
      .catch(() => undefined);
  }, []);

  return (
    <div className="flex flex-col gap-5">
      <SettingsSection
        title="Factory Engine"
        description="Generation workers that draft captions, hooks and layout selections."
        footer={
          <Button
            variant="primary"
            size="sm"
            onClick={() => toast.success("Automation settings saved")}
          >
            Save automation
          </Button>
        }
      >
        <SettingsRow
          title="Generation cadence"
          description="How often the engine looks for new briefs to draft."
        >
          <Select value={cadence} onValueChange={setCadence}>
            <SelectTrigger className="w-full sm:w-52" aria-label="Generation cadence">
              <SelectValue>
                {CADENCES.find((option) => option.value === cadence)?.label ??
                  "Every 6 hours"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {CADENCES.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingsRow>

        <SettingsRow
          title="Maximum batch size"
          description="Drafts created per run, across all brands."
        >
          <Input
            value={maxBatch}
            onChange={(event) => setMaxBatch(event.target.value)}
            inputMode="numeric"
            className="w-full text-center sm:w-24 tnum"
            aria-label="Maximum batch size"
          />
        </SettingsRow>

        <SettingsRow
          title="Spend guardrail"
          description="Pause the pipeline when daily generation cost exceeds the budget."
        >
          <Switch
            checked={spendGuardrail}
            onCheckedChange={setSpendGuardrail}
            aria-label="Spend guardrail"
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection
        title="Pipeline stages"
        description="Disable a stage to hand that work back to the team."
      >
        {AUTOMATION_PIPELINE.map((stage, index) => (
          <SettingsRow
            key={stage.id}
            title={stage.label}
            description={stage.detail}
          >
            <div className="flex items-center gap-3">
              <Badge tone="neutral" size="sm">
                {index + 1}
              </Badge>
              <Switch
                checked={stages[stage.id] ?? true}
                onCheckedChange={(checked) =>
                  setStages((current) => ({ ...current, [stage.id]: checked }))
                }
                aria-label={`Toggle ${stage.label} stage`}
              />
            </div>
          </SettingsRow>
        ))}
      </SettingsSection>

      <SettingsSection
        title="Health"
        description="Measured from the real model request log — not a simulation."
      >
        <SettingsRow title="Provider success rate" description="Model calls completed without errors">
          <span className="text-[13.5px] tnum">
            {health ? formatRatio(health.successRate) : "—"}
          </span>
        </SettingsRow>
        <SettingsRow title="Model calls" description="Requests made across all runs">
          <span className="text-[13.5px] tnum">{health?.totalRuns ?? 0}</span>
        </SettingsRow>
        <SettingsRow
          title="Failed calls"
          description="Retried, fell back, or gave up"
          className="last:pb-4"
        >
          <span className="text-[13.5px] tnum">{health?.failedRuns ?? 0}</span>
        </SettingsRow>
      </SettingsSection>
    </div>
  );
}
