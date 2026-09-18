"use client";

import { Check, CircleAlert, FlaskConical, LoaderCircle, RotateCcw, Trophy } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { MAIN_NICHES, SUB_NICHES, getSubNiche } from "@/design/sub-niches";
import type { DesignVariant, MainNiche } from "@/design/types";
import { experimentsApi } from "@/lib/api/design-client";
import type { ExperimentDecision } from "@/lib/repositories/experiments-repository";
import { formatNumber } from "@/lib/format";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

/**
 * The experiment programme.
 *
 * Structure: for each sub-niche, each audience runs exactly two design variants
 * (A/B). Enter the real numbers from Insights, record the verdict, and the
 * winner is promoted — future posts for that audience are composed with the
 * winning design and its content angle, so the factory converges on what the
 * audience demonstrably wants instead of what looked good in the meeting.
 *
 * The metrics fields accept anything Insights shows; the comparison ratios are
 * computed, not typed, so the verdict is honest even when reach differs wildly.
 */

interface SimulatedResult {
  variantId: string;
  reach: number;
  engagementRate: number;
  saves: number;
  follows: number;
}

const TABS: MainNiche[] = ["geography", "psychology", "branding"];

export function ExperimentsView() {
  const [decisions, setDecisions] = useState<ExperimentDecision[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<MainNiche>("geography");
  const [recordFor, setRecordFor] = useState<{ subNicheId: string; audienceId: string } | null>(
    null,
  );
  const [confirmReset, setConfirmReset] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await experimentsApi.list();
      setDecisions(result.decisions);
    } catch {
      toast.error("Could not load experiment decisions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const subNiches = useMemo(
    () => SUB_NICHES.filter((sub) => sub.mainNiche === tab),
    [tab],
  );

  const decidedCount = decisions.length;

  return (
    <>
      <PageHeader
        eyebrow="Experiments"
        title="Find what works"
        description="Two design variants for each niche. Post both, compare numbers, keep the winner."
        actions={
          <Button variant="secondary" size="sm" onClick={() => setConfirmReset(true)}>
            <RotateCcw />
            Reset ledger
          </Button>
        }
      />

      <div className="shell-container flex flex-col gap-5 pb-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-0.5 rounded-full border border-line bg-surface p-0.5">
            {TABS.map((niche) => (
              <button
                key={niche}
                type="button"
                onClick={() => setTab(niche)}
                aria-pressed={tab === niche}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-[12.5px] font-medium transition-colors duration-150 ease-soft",
                  tab === niche ? "bg-ink text-canvas" : "text-ink-2 hover:text-ink",
                )}
              >
                {MAIN_NICHES.find((entry) => entry.id === niche)?.label}
              </button>
            ))}
          </div>

          <Badge tone={decidedCount > 0 ? "success" : "neutral"} size="sm">
            {decidedCount} of 18 audience tests decided
          </Badge>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <LoaderCircle className="size-5 animate-spin text-ink-3" />
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {subNiches.map((sub) => (
              <SubNicheCard
                key={sub.id}
                subNicheId={sub.id}
                label={sub.label}
                rationale={sub.rationale}
                variants={sub.variants}
                decisions={decisions}
                onRecord={(audienceId) =>
                  setRecordFor({ subNicheId: sub.id, audienceId })
                }
              />
            ))}
          </div>
        )}
      </div>

      {recordFor ? (
        <RecordDecisionModal
          subNicheId={recordFor.subNicheId}
          audienceId={recordFor.audienceId}
          onClose={() => setRecordFor(null)}
          onRecorded={() => {
            setRecordFor(null);
            void refresh();
          }}
        />
      ) : null}

      <Modal
        open={confirmReset}
        onOpenChange={setConfirmReset}
        size="sm"
        title="Reset the experiment ledger?"
        description="Every recorded verdict is deleted. Variant definitions are not affected."
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setConfirmReset(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                setConfirmReset(false);
                void experimentsApi
                  .reset()
                  .then(refresh)
                  .then(() => toast.success("Ledger cleared"));
              }}
            >
              Reset
            </Button>
          </>
        }
      >
        <p className="pb-2 text-[12.5px] text-ink-2">
          {decisions.length} {decisions.length === 1 ? "verdict" : "verdicts"} will be
          removed.
        </p>
      </Modal>
    </>
  );
}

/* ------------------------------- sub-niche --------------------------------- */

function SubNicheCard({
  subNicheId,
  label,
  rationale,
  variants,
  decisions,
  onRecord,
}: {
  subNicheId: string;
  label: string;
  rationale: string;
  variants: [DesignVariant, DesignVariant];
  decisions: ExperimentDecision[];
  onRecord: (audienceId: string) => void;
}) {
  const sub = getSubNiche(subNicheId);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-1">
          <CardTitle>{label}</CardTitle>
          <p className="max-w-3xl text-[13px] leading-relaxed text-ink-2">{rationale}</p>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4 pt-0">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {variants.map((variant) => (
            <div key={variant.id} className="flex flex-col gap-2 rounded-lg border border-line p-3.5">
              <div className="flex items-center gap-2">
                <span className="flex gap-0.5">
                  {[variant.overrides.palette?.background, variant.overrides.palette?.accent]
                    .filter(Boolean)
                    .map((colour) => (
                      <span
                        key={colour}
                        className="size-3 rounded-full border border-black/10"
                        style={{ backgroundColor: colour }}
                      />
                    ))}
                </span>
                <span className="text-[13px] font-medium text-ink">{variant.label}</span>
              </div>
              <p className="text-[12px] leading-relaxed text-ink-2">{variant.thesis}</p>
              <p className="text-[12px] leading-relaxed text-ink-3">
                <span className="text-ink-2">Angle:</span> {variant.contentAngle}
              </p>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-medium tracking-[0.08em] text-ink-3 uppercase">
            Audiences
          </span>
          {sub?.audiences.map((audience) => {
            const decision = decisions.find(
              (entry) => entry.audienceId === audience.id,
            );
            const winner =
              decision && sub
                ? (sub.variants.find((variant) => variant.id === decision.winnerId) ?? null)
                : null;

            return (
              <div
                key={audience.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-line px-3.5 py-3"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-[13px] font-medium text-ink">
                    {audience.label}{" "}
                    <span className="font-normal text-ink-3">· {audience.ageRange}</span>
                  </span>
                  <span className="text-[12px] leading-relaxed text-ink-2">
                    {audience.painPoint}
                  </span>
                  <span className="text-[11.5px] leading-relaxed text-ink-3">
                    {audience.demandSignal} · est. {audience.sizeEstimate}
                  </span>
                </div>

                {decision && winner ? (
                  <div className="flex items-center gap-2">
                    <Badge tone="success" size="md">
                      <Trophy className="size-3" />
                      {winner.label}
                    </Badge>
                    <Button size="xs" variant="secondary" onClick={() => onRecord(audience.id)}>
                      Re-test
                    </Button>
                  </div>
                ) : (
                  <Button size="xs" variant="primary" onClick={() => onRecord(audience.id)}>
                    <FlaskConical />
                    Run test
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------------------------- record modal --------------------------------- */

function RecordDecisionModal({
  subNicheId,
  audienceId,
  onClose,
  onRecorded,
}: {
  subNicheId: string;
  audienceId: string;
  onClose: () => void;
  onRecorded: () => void;
}) {
  const sub = getSubNiche(subNicheId);
  const audience = sub?.audiences.find((entry) => entry.id === audienceId);
  const [variantA, variantB] = sub?.variants ?? [];

  const [metricsA, setMetricsA] = useState<SimulatedResult>({
    variantId: variantA?.id ?? "",
    reach: 0,
    engagementRate: 0,
    saves: 0,
    follows: 0,
  });
  const [metricsB, setMetricsB] = useState<SimulatedResult>({
    variantId: variantB?.id ?? "",
    reach: 0,
    engagementRate: 0,
    saves: 0,
    follows: 0,
  });
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  if (!sub || !audience || !variantA || !variantB) return null;

  const subNiche = sub;
  const testAudience = audience;

  const score = (metrics: SimulatedResult) =>
    // Composite: engagement weighted by its conversion into reach and follows.
    metrics.reach * (metrics.engagementRate / 100) + metrics.follows * 2 + metrics.saves * 0.5;

  const scoreA = score(metricsA);
  const scoreB = score(metricsB);
  const filled = metricsA.reach > 0 && metricsB.reach > 0;
  const winner = scoreA === scoreB ? null : scoreA > scoreB ? variantA : variantB;
  const loser = winner === variantA ? variantB : winner === variantB ? variantA : null;

  async function record() {
    if (!winner || !loser) return;
    setSaving(true);
    try {
      await experimentsApi.record({
        subNicheId: subNiche.id,
        audienceId: testAudience.id,
        winnerId: winner.id,
        loserId: loser.id,
        metrics:
          winner === variantA
            ? {
                reach: metricsA.reach,
                engagementRate: metricsA.engagementRate,
                saves: metricsA.saves,
                follows: metricsA.follows,
              }
            : {
                reach: metricsB.reach,
                engagementRate: metricsB.engagementRate,
                saves: metricsB.saves,
                follows: metricsB.follows,
              },
        note: note.trim(),
      });
      toast.success(`${winner.label} wins for ${testAudience.label}`, {
        description: "Future posts for this audience will use the winning design.",
      });
      onRecorded();
    } catch (error) {
      toast.error("Could not record the decision", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onOpenChange={(open) => (open ? null : onClose())}
      size="lg"
      title={`A/B test — ${audience.label}`}
      description="Paste the numbers from Instagram Insights for each variant's posts."
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={!winner || saving}
            onClick={() => void record()}
          >
            {saving ? <LoaderCircle className="animate-spin" /> : <Check />}
            Promote {winner ? winner.label : "winner"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 pb-2">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <MetricsForm
            title={variantA.label}
            tone="a"
            metrics={metricsA}
            onChange={setMetricsA}
            score={scoreA}
          />
          <MetricsForm
            title={variantB.label}
            tone="b"
            metrics={metricsB}
            onChange={setMetricsB}
            score={scoreB}
          />
        </div>

        {!filled ? (
          <p className="flex items-center gap-2 text-[12.5px] text-ink-3">
            <CircleAlert className="size-3.5" />
            Enter the reach for both variants to compute the verdict.
          </p>
        ) : winner ? (
          <p className="text-[12.5px] leading-relaxed text-ink-2">
            <span className="font-medium text-ink">{winner.label}</span> leads by{" "}
            {scoreA === scoreB
              ? "0"
              : `${Math.round(
                  (Math.max(scoreA, scoreB) / Math.max(Math.min(scoreA, scoreB), 1) - 1) * 100,
                )}%`}{" "}
            on the composite score.
          </p>
        ) : null}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="decision-note">What the data said (one line)</Label>
          <Input
            id="decision-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Saves doubled on the dark cartographic variant."
          />
        </div>
      </div>
    </Modal>
  );
}

function MetricsForm({
  title,
  tone,
  metrics,
  onChange,
  score,
}: {
  title: string;
  tone: "a" | "b";
  metrics: SimulatedResult;
  onChange: (metrics: SimulatedResult) => void;
  score: number;
}) {
  const fields: Array<{ key: keyof Omit<SimulatedResult, "variantId">; label: string }> = [
    { key: "reach", label: "Reach" },
    { key: "engagementRate", label: "Engagement %" },
    { key: "saves", label: "Saves" },
    { key: "follows", label: "Follows" },
  ];

  return (
    <div
      className={cn(
        "flex flex-col gap-2.5 rounded-lg border p-3.5",
        tone === "a" ? "border-line" : "border-line",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12.5px] font-medium text-ink">{title}</span>
        {metrics.reach > 0 ? (
          <Badge tone="neutral" size="sm">
            score {formatNumber(Math.round(score))}
          </Badge>
        ) : null}
      </div>

      {fields.map((field) => (
        <div key={field.key} className="flex items-center gap-2">
          <Label htmlFor={`${tone}-${field.key}`} className="w-24 shrink-0 text-[11.5px] text-ink-2">
            {field.label}
          </Label>
          <Input
            id={`${tone}-${field.key}`}
            type="number"
            min={0}
            step={field.key === "engagementRate" ? 0.1 : 1}
            value={metrics[field.key] || ""}
            onChange={(event) =>
              onChange({ ...metrics, [field.key]: Number(event.target.value) || 0 })
            }
            className="h-8 flex-1"
          />
        </div>
      ))}
    </div>
  );
}
