"use client";

import { CircleAlert, CircleCheck, LoaderCircle, PlugZap, Trash } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import {
  SettingsRow,
  SettingsSection,
} from "@/features/settings/components/settings-row";
import { aiApi, type ProviderTestResult } from "@/lib/api/ai-client";
import { AI_PROVIDER_LABELS, formatLatency } from "@/lib/ai/ui";
import { toast } from "@/lib/toast";
import type { AiLogSummary, AiProviderDescriptor } from "@/types";

type TestState =
  | { status: "idle" }
  | { status: "running" }
  | { status: "done"; result: ProviderTestResult };

/**
 * The engine's control room.
 *
 * Credentials never reach the browser — the server reports whether a key exists
 * and what to call the variable, and the test button asks the server to make one
 * real, tiny request per provider so "configured" can mean "working" rather than
 * "the string is present".
 */
export function AiPanel() {
  const [providers, setProviders] = useState<AiProviderDescriptor[] | null>(null);
  const [summary, setSummary] = useState<AiLogSummary | null>(null);
  const [tests, setTests] = useState<Record<string, TestState>>({});
  const [clearOpen, setClearOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  const load = useCallback(async () => {
    const [providerResult, logResult] = await Promise.all([
      aiApi.providers(),
      aiApi.logs({ limit: 1 }),
    ]);
    setProviders(providerResult.providers);
    setSummary(logResult.summary);
  }, []);

  useEffect(() => {
    void load().catch(() =>
      toast.error("Could not read the AI configuration", {
        description: "The provider list is served by the workspace server.",
      }),
    );
  }, [load]);

  async function test(id: string) {
    setTests((current) => ({ ...current, [id]: { status: "running" } }));
    try {
      const result = await aiApi.testProvider(id);
      setTests((current) => ({ ...current, [id]: { status: "done", result } }));
      void load();
    } catch (error) {
      setTests((current) => ({
        ...current,
        [id]: {
          status: "done",
          result: {
            ok: false,
            provider: id,
            error: error instanceof Error ? error.message : "Test failed",
          },
        },
      }));
    }
  }

  async function clear() {
    setClearing(true);
    try {
      const { removed } = await aiApi.clearLogs();
      setClearOpen(false);
      void load();
      toast.success("AI log cleared", {
        description: `${removed} ${removed === 1 ? "entry" : "entries"} removed.`,
      });
    } catch {
      toast.error("Could not clear the AI log");
    } finally {
      setClearing(false);
    }
  }

  const configuredCount = providers?.filter((provider) => provider.configured).length ?? 0;

  return (
    <div className="flex flex-col gap-5">
      <SettingsSection
        title="Provider chain"
        description="Gemini answers first. A quota, rate limit or bad response hands the step to the next provider, with exponential backoff before any retry."
      >
        {providers === null ? (
          <div className="flex flex-col gap-2 py-4">
            {[0, 1, 2].map((row) => (
              <Skeleton key={row} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        ) : (
          <ol className="flex flex-col divide-y divide-line">
            {providers
              .slice()
              .sort((a, b) => a.priority - b.priority)
              .map((provider, index) => {
                const state = tests[provider.id] ?? { status: "idle" };

                return (
                  <li key={provider.id} className="flex flex-col gap-3 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border border-line font-mono text-[11px] text-ink-2 tnum">
                          {index + 1}
                        </span>

                        <span className="flex min-w-0 flex-col gap-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="text-[13.5px] font-medium text-ink">
                              {provider.label}
                            </span>
                            <Badge
                              tone={provider.configured ? "success-outline" : "neutral"}
                              size="sm"
                            >
                              {provider.configured ? "Key present" : "No key"}
                            </Badge>
                            {provider.roles.includes("primary") ? (
                              <Badge tone="accent-outline" size="sm">
                                Primary
                              </Badge>
                            ) : (
                              <Badge tone="neutral" size="sm">
                                Fallback
                              </Badge>
                            )}
                            {provider.supportsGrounding ? (
                              <Badge tone="neutral" size="sm">
                                Web grounding
                              </Badge>
                            ) : null}
                          </span>

                          <span className="font-mono text-[11.5px] text-ink-2">
                            {provider.model}
                          </span>
                          <span className="max-w-xl text-[12.5px] leading-relaxed text-ink-2">
                            {provider.note}
                          </span>
                          {!provider.configured ? (
                            <span className="font-mono text-[11.5px] text-ink-3">
                              {provider.envKeys.join(", ")}
                            </span>
                          ) : null}
                        </span>
                      </div>

                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={!provider.configured || state.status === "running"}
                        onClick={() => void test(provider.id)}
                      >
                        {state.status === "running" ? (
                          <LoaderCircle className="animate-spin" />
                        ) : (
                          <PlugZap />
                        )}
                        Test
                      </Button>
                    </div>

                    {state.status === "done" ? (
                      <div
                        className={
                          state.result.ok
                            ? "flex items-center gap-2 rounded-lg border border-success/25 bg-success-soft px-3.5 py-2.5 text-[12.5px] text-ink-2"
                            : "flex items-start gap-2 rounded-lg border border-danger/25 bg-danger-soft px-3.5 py-2.5 text-[12.5px] text-ink-2"
                        }
                      >
                        {state.result.ok ? (
                          <CircleCheck className="mt-0.5 size-3.5 shrink-0 text-success" />
                        ) : (
                          <CircleAlert className="mt-0.5 size-3.5 shrink-0 text-danger" />
                        )}
                        <span>
                          {state.result.ok
                            ? `Answered in ${formatLatency(state.result.latencyMs ?? 0)}${
                                state.result.grounded ? " with web grounding" : ""
                              }.`
                            : (state.result.error ?? "The provider did not answer.")}
                        </span>
                      </div>
                    ) : null}
                  </li>
                );
              })}
          </ol>
        )}
      </SettingsSection>

      <SettingsSection
        title="Request log"
        description="Every prompt and response is stored in data/ai-logs.json and shown on the dashboard. The newest 400 calls are kept."
      >
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 py-4 sm:grid-cols-4">
          <Stat label="Model calls" value={summary ? String(summary.total) : "—"} />
          <Stat label="Failed" value={summary ? String(summary.failed) : "—"} />
          <Stat
            label="Avg latency"
            value={summary ? formatLatency(summary.averageLatencyMs) : "—"}
          />
          <Stat
            label="Fallback share"
            value={summary ? `${Math.round(summary.fallbackRate * 100)}%` : "—"}
          />
        </dl>

        {summary && summary.byProvider.length > 0 ? (
          <SettingsRow
            title="Calls by provider"
            description="Falling back is not a failure, but it should never be invisible."
          >
            <span className="flex flex-wrap justify-end gap-1.5">
              {summary.byProvider.map((entry) => (
                <Badge key={entry.provider} tone="neutral" size="sm">
                  {AI_PROVIDER_LABELS[entry.provider]}
                  <span className="text-ink-3 tnum">
                    {entry.total}
                    {entry.failed > 0 ? ` · ${entry.failed} failed` : ""}
                  </span>
                </Badge>
              ))}
            </span>
          </SettingsRow>
        ) : null}

        <SettingsRow
          title="Configured providers"
          description="At least one key is required before anything can be generated."
          className="last:pb-4"
        >
          <span className="flex items-center gap-2">
            <Badge tone={configuredCount > 0 ? "success" : "danger"} size="md">
              {configuredCount > 0
                ? `${configuredCount} ready`
                : "Nothing configured"}
            </Badge>
            <Button variant="danger" size="sm" onClick={() => setClearOpen(true)}>
              <Trash />
              Clear log
            </Button>
          </span>
        </SettingsRow>
      </SettingsSection>

      <Modal
        open={clearOpen}
        onOpenChange={setClearOpen}
        size="sm"
        title="Clear the AI request log?"
        description="The audit trail of every prompt and response is deleted. Generated posts are not affected."
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setClearOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" disabled={clearing} onClick={() => void clear()}>
              {clearing ? <LoaderCircle className="animate-spin" /> : <Trash />}
              Clear log
            </Button>
          </>
        }
      >
        <p className="pb-2 text-[12.5px] leading-relaxed text-ink-2">
          {summary
            ? `${summary.total} ${summary.total === 1 ? "entry" : "entries"} will be removed, including the ${
                summary.failed
              } that failed.`
            : "The log is empty."}
        </p>
      </Modal>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[11px] tracking-[0.04em] text-ink-3 uppercase">{label}</dt>
      <dd className="text-[15px] font-medium text-ink tnum">{value}</dd>
    </div>
  );
}
