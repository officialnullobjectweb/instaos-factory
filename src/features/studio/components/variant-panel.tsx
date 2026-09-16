"use client";

import { Check, FlaskConical, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  MAIN_NICHES,
  SUB_NICHES,
  getSubNiche,
} from "@/design/sub-niches";
import type { DesignVariant, MainNiche } from "@/design/types";
import { toast } from "@/lib/toast";
import { useStudioStore } from "@/features/studio/store/studio-store";
import { cn } from "@/lib/utils";

/**
 * The variant panel: the studio's bridge to the experiment programme.
 *
 * Picking a sub-niche narrows to its two design variants; applying a variant
 * loads its palette, typography and footer overrides into the canvas, so what
 * is being tested visually is exactly what the variant defines — not a
 * description of it.
 */
export function VariantPanel() {
  const document_ = useStudioStore((state) => state.document);
  const load = useStudioStore((state) => state.load);
  const [mainNiche, setMainNiche] = useState<MainNiche>("geography");
  const [openSubNiche, setOpenSubNiche] = useState<string | null>(null);

  const subNiches = SUB_NICHES.filter((sub) => sub.mainNiche === mainNiche);
  const activeSub = openSubNiche ? getSubNiche(openSubNiche) : null;

  function applyVariant(subNicheId: string, variant: DesignVariant) {
    load({
      templateId: variant.templateId,
      overrides: variant.overrides,
      slides: document_.slides,
    });
    toast.success(`Variant applied: ${variant.label}`, {
      description: `Design loaded from ${subNicheId}. Generate posts with it to run the test.`,
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>Niche & variants</CardTitle>
          <Link href="/experiments" className="text-[12px] text-ink-2 hover:text-ink">
            <FlaskConical className="size-3.5" aria-hidden="true" />
          </Link>
        </div>
        <p className="text-[13px] text-ink-2">
          Apply a tested variant&apos;s design, or explore the audience briefs.
        </p>
      </CardHeader>

      <CardContent className="flex flex-col gap-3 pt-0">
        <div className="flex gap-1">
          {MAIN_NICHES.map((niche) => (
            <button
              key={niche.id}
              type="button"
              onClick={() => {
                setMainNiche(niche.id);
                setOpenSubNiche(null);
              }}
              aria-pressed={mainNiche === niche.id}
              className={cn(
                "flex-1 rounded-full border px-2 py-1.5 text-[11.5px] font-medium transition-colors duration-150 ease-soft",
                mainNiche === niche.id
                  ? "border-ink/25 bg-surface-2 text-ink"
                  : "border-line text-ink-2 hover:text-ink",
              )}
            >
              {niche.label}
            </button>
          ))}
        </div>

        <ul className="flex flex-col divide-y divide-line">
          {subNiches.map((sub) => (
            <li key={sub.id} className="flex flex-col py-2">
              <button
                type="button"
                onClick={() => setOpenSubNiche(openSubNiche === sub.id ? null : sub.id)}
                aria-expanded={openSubNiche === sub.id}
                className="flex items-center justify-between gap-2 text-left"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[12.5px] font-medium text-ink">
                    {sub.label}
                  </span>
                  <span className="block truncate text-[11px] text-ink-3">
                    {sub.rationale}
                  </span>
                </span>
                <Badge tone="neutral" size="sm">
                  {sub.variants.length}
                </Badge>
              </button>

              {activeSub?.id === sub.id ? (
                <div className="mt-2 flex flex-col gap-2">
                  <AudienceBrief subNicheId={sub.id} />

                  {sub.variants.map((variant) => {
                    const applied =
                      document_.templateId === variant.templateId &&
                      JSON.stringify(document_.overrides) === JSON.stringify(variant.overrides);

                    return (
                      <div
                        key={variant.id}
                        className="flex flex-col gap-1.5 rounded-lg border border-line p-2.5"
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="flex gap-0.5">
                            {[
                              variant.overrides.palette?.background,
                              variant.overrides.palette?.accent,
                            ]
                              .filter(Boolean)
                              .map((colour) => (
                                <span
                                  key={colour}
                                  className="size-2.5 rounded-full border border-black/10"
                                  style={{ backgroundColor: colour }}
                                />
                              ))}
                          </span>
                          <span className="text-[12px] font-medium text-ink">
                            {variant.label}
                          </span>
                        </div>
                        <p className="text-[11.5px] leading-relaxed text-ink-2">
                          {variant.thesis}
                        </p>
                        <Button
                          size="xs"
                          variant={applied ? "secondary" : "primary"}
                          className="w-fit"
                          onClick={() => applyVariant(sub.id, variant)}
                        >
                          {applied ? <Check className="size-3" /> : null}
                          {applied ? "Applied" : "Apply design"}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function AudienceBrief({ subNicheId }: { subNicheId: string }) {
  const sub = getSubNiche(subNicheId);
  if (!sub) return null;

  return (
    <div className="flex flex-col gap-2 rounded-lg bg-surface-2 p-2.5">
      <span className="flex items-center gap-1.5 text-[10.5px] font-medium tracking-[0.08em] text-ink-3 uppercase">
        <Users className="size-3" />
        Audiences under test
      </span>
      {sub.audiences.map((audience) => (
        <div key={audience.id} className="flex flex-col gap-0.5">
          <span className="text-[12px] font-medium text-ink">
            {audience.label}{" "}
            <span className="font-normal text-ink-3">({audience.ageRange})</span>
          </span>
          <span className="text-[11.5px] leading-relaxed text-ink-2">
            Pain: {audience.painPoint}
          </span>
          <span className="text-[11.5px] leading-relaxed text-ink-3">
            Signal: {audience.demandSignal}
          </span>
        </div>
      ))}
    </div>
  );
}

