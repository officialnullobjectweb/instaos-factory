"use client";

import { ArrowRight, CircleAlert, CirclePlus, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

import { StatusBadge } from "@/components/content/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { brands, getBrand } from "@/data/brands";
import { SUB_NICHES } from "@/design/sub-niches";
import { GenerationProgress } from "@/features/generation/components/generation-progress";
import { useGeneration } from "@/features/generation/hooks/use-generation";
import { usePostsActions } from "@/hooks/use-posts";
import { useUIStore } from "@/store/ui-store";
import type { BrandId, PostCategory } from "@/types";

type CategoryChoice = PostCategory | "brand";

/**
 * The manual trigger for the generation engine.
 *
 * One instance is mounted for the whole workspace and opened from the sidebar,
 * the command bar, the dashboard and the queue, so a run survives navigation:
 * the job lives on the server, and this dialog only renders its progress.
 */
export function GenerateDialog() {
  const open = useUIStore((state) => state.generateOpen);
  const presetBrand = useUIStore((state) => state.generateBrand);
  const setGenerateOpen = useUIStore((state) => state.setGenerateOpen);
  const { openPost } = usePostsActions();

  const [brandId, setBrandId] = useState<BrandId>("midnight-ritual");
  const [category, setCategory] = useState<CategoryChoice>("brand");
  const [steer, setSteer] = useState("");
  const [granular, setGranular] = useState(true);
  /** Optional experiment attribution: which sub-niche test this post serves. */
  const [subNicheId, setSubNicheId] = useState<string>("");
  const [variantId, setVariantId] = useState<string>("");
  const [audienceId, setAudienceId] = useState<string>("");

  const {
    phase,
    job,
    error,
    detail,
    requiredEnvVars,
    post,
    resumable,
    run,
    resume,
    reset,
  } = useGeneration();

  const brand = getBrand(brandId);
  /** `queued` is a live state, not a stalled one: the run is waiting for a slot. */
  const running = phase === "running" || phase === "queued";

  // A fresh open always starts from a clean slate — except the brand handed in
  // by whoever opened it (the topbar scope, a brand card, the queue).
  useEffect(() => {
    if (!open) return;
    reset();
    if (presetBrand && brands.some((entry) => entry.id === presetBrand)) {
      setBrandId(presetBrand as BrandId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, presetBrand]);

  const activeSubNiche = SUB_NICHES.find((sub) => sub.id === subNicheId) ?? null;
  const activeVariant =
    activeSubNiche?.variants.find((variant) => variant.id === variantId) ?? null;
  const activeAudience =
    activeSubNiche?.audiences.find((entry) => entry.id === audienceId) ?? null;

  function start() {
    void run({
      brandId,
      category: category === "brand" ? undefined : category,
      steer:
        steer.trim() ||
        // A variant's content angle is the steer when the reviewer leaves it blank.
        (activeVariant ? activeVariant.contentAngle : undefined),
      granular,
      subNicheId: subNicheId || undefined,
      variantId: variantId || undefined,
      audienceId: audienceId || undefined,
    });
  }

  return (
    <Modal
      open={open}
      onOpenChange={setGenerateOpen}
      size="lg"
      title="Generate a new post"
      description={
        phase === "queued"
          ? "Waiting for a free generation slot. You can close this — the run continues on the server."
          : phase === "running"
            ? "The engine is running. A full pass takes five to ten minutes — you can close this and the post will still land in the queue."
            : `Topic, research, fact-check, carousel, caption, hashtags, alt text and a quality score, in one pass for ${brand.name}.`
      }
      footer={
        <>
          {phase === "succeeded" ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setGenerateOpen(false)}
              >
                Done
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setGenerateOpen(false);
                  if (post) openPost(post.id);
                }}
              >
                Open in review
                <ArrowRight />
              </Button>
            </>
          ) : phase === "failed" ? (
            <>
              <Button variant="ghost" size="sm" onClick={reset}>
                Start over
              </Button>
              {resumable ? (
                <Button variant="primary" size="sm" onClick={() => void resume()}>
                  <RefreshCw />
                  Resume from step
                </Button>
              ) : (
                <Button variant="primary" size="sm" onClick={start}>
                  <RefreshCw />
                  Try again
                </Button>
              )}
            </>
          ) : running ? (
            <Button variant="ghost" size="sm" onClick={() => setGenerateOpen(false)}>
              Continue in background
            </Button>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setGenerateOpen(false)}
              >
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={start}>
                <CirclePlus />
                Generate post
              </Button>
            </>
          )}
        </>
      }
    >
      {running && job ? (
        <div className="flex flex-col gap-4 pb-2">
          <p className="text-[12.5px] text-ink-2">
            Generating for <span className="text-ink">{brand.name}</span> — every
            step is written to the AI log as it finishes.
          </p>
          <GenerationProgress job={job} />
        </div>
      ) : phase === "succeeded" && post ? (
        <div className="flex flex-col gap-4 pb-2">
          <div className="flex flex-col gap-2 rounded-lg border border-line bg-surface-2 p-4">
            <span className="flex items-center gap-2">
              <StatusBadge status={post.status} size="sm" />
              <Badge tone="neutral" size="sm">
                {post.quality.score}/100 quality
              </Badge>
              <Badge tone="neutral" size="sm">
                {post.slides.length} slides
              </Badge>
            </span>
            <p className="text-[14px] font-medium tracking-[-0.01em] text-ink">
              {post.title}
            </p>
            <p className="text-[12.5px] leading-relaxed text-ink-2">
              {post.slides[0]?.body}
            </p>
          </div>

          {post.quality.blockers.length > 0 ? (
            <div className="flex flex-col gap-1.5 rounded-lg border border-warning/25 bg-warning-soft p-3.5">
              <span className="text-[12px] font-medium text-warning">
                {post.quality.blockers.length === 1
                  ? "1 blocker to clear before approval"
                  : `${post.quality.blockers.length} blockers to clear before approval`}
              </span>
              {post.quality.blockers.map((blocker) => (
                <span key={blocker} className="text-[12.5px] leading-relaxed text-ink-2">
                  {blocker}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : phase === "failed" ? (
        <div className="flex flex-col gap-3 pb-2">
          <div className="flex items-start gap-2.5 rounded-lg border border-danger/25 bg-danger-soft p-3.5">
            <CircleAlert className="mt-0.5 size-4 shrink-0 text-danger" />
            <span className="flex flex-col gap-1">
              <span className="text-[12.5px] font-medium text-danger">
                The generation engine could not finish
              </span>
              <span className="text-[12.5px] leading-relaxed text-ink-2">{error}</span>
              {detail ? (
                <span className="text-[12px] leading-relaxed text-ink-3">{detail}</span>
              ) : null}
            </span>
          </div>

          {resumable ? (
            <div className="flex flex-col gap-1.5 rounded-lg border border-line bg-surface-2 p-3.5">
              <span className="text-[12px] font-medium text-ink">
                Resume instead of repeating
              </span>
              <span className="text-[12.5px] leading-relaxed text-ink-2">
                {resumable.summary}
              </span>
              <span className="text-[11.5px] text-ink-3 tnum">
                {resumable.tokensAlreadySpent.toLocaleString()} tokens already spent on
                this run are kept.
              </span>
            </div>
          ) : null}

          {requiredEnvVars ? (
            <div className="flex flex-col gap-1.5 rounded-lg border border-line bg-surface-2 p-3.5">
              <span className="text-[12px] font-medium text-ink">
                Add a key to .env.local, then restart the dev server
              </span>
              <code className="font-mono text-[11.5px] text-ink-2">
                {requiredEnvVars.map((key) => `${key}=`).join("\n")}
              </code>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-4 pb-2">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="generate-brand">Brand</Label>
              <Select
                value={brandId}
                onValueChange={(value) => setBrandId(value as BrandId)}
              >
                <SelectTrigger id="generate-brand" className="w-full">
                  <SelectValue>{brand.name}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {brands.map((entry) => (
                    <SelectItem key={entry.id} value={entry.id}>
                      {entry.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="generate-category">Category</Label>
              <Select
                value={category}
                onValueChange={(value) => setCategory(value as CategoryChoice)}
              >
                <SelectTrigger id="generate-category" className="w-full">
                  <SelectValue>
                    {category === "brand" ? `Brand default · ${brand.category}` : category}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="brand">
                    {`Brand default · ${brand.category}`}
                  </SelectItem>
                  <SelectItem value="Geography">Geography</SelectItem>
                  <SelectItem value="Psychology">Psychology</SelectItem>
                  <SelectItem value="Branding">Branding</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Experiment attribution — optional, but stamps the post for the ledger. */}
          <div className="grid grid-cols-1 gap-4 rounded-lg border border-line p-3.5 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="generate-subniche">Sub-niche test</Label>
              <Select
                value={subNicheId}
                onValueChange={(value) => {
                  setSubNicheId(value);
                  setVariantId("");
                  setAudienceId("");
                }}
              >
                <SelectTrigger id="generate-subniche" className="w-full">
                  <SelectValue>{subNicheId ? activeSubNiche?.label : "None"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {SUB_NICHES.map((sub) => (
                    <SelectItem key={sub.id} value={sub.id}>
                      {sub.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="generate-variant">Variant</Label>
              <Select
                value={variantId}
                onValueChange={setVariantId}
                disabled={!activeSubNiche}
              >
                <SelectTrigger id="generate-variant" className="w-full">
                  <SelectValue>{variantId ? activeVariant?.label : "—"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(activeSubNiche?.variants ?? []).map((variant) => (
                    <SelectItem key={variant.id} value={variant.id}>
                      {variant.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="generate-audience">Audience</Label>
              <Select
                value={audienceId}
                onValueChange={setAudienceId}
                disabled={!activeSubNiche}
              >
                <SelectTrigger id="generate-audience" className="w-full">
                  <SelectValue>{audienceId ? activeAudience?.label : "—"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(activeSubNiche?.audiences ?? []).map((entry) => (
                    <SelectItem key={entry.id} value={entry.id}>
                      {entry.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="generate-steer">Steer the topic (optional)</Label>
            <Textarea
              id="generate-steer"
              value={steer}
              onChange={(event) => setSteer(event.target.value)}
              placeholder="Something about how morning light changes a room before anyone is awake."
              className="min-h-20"
            />
            <span className="text-[11.5px] text-ink-3">
              Leave empty and the engine picks the strongest open pillar.
            </span>
          </div>

          <div className="flex items-start justify-between gap-4 rounded-lg border border-line bg-surface-2 p-3.5">
            <span className="flex flex-col gap-0.5">
              <span className="text-[13px] font-medium text-ink">Granular steps</span>
              <span className="max-w-md text-[12px] leading-relaxed text-ink-2">
                One model call per block — carousel, caption, hashtags, alt text and
                the quality score are each scored and logged separately, which is
                slower but leaves a far better audit trail.
              </span>
            </span>
            <Switch
              checked={granular}
              onCheckedChange={setGranular}
              aria-label="Run each generation step as its own model call"
            />
          </div>

          <div className="flex flex-col gap-2 rounded-lg border border-line p-3.5">
            <span className="text-[11px] tracking-[0.06em] text-ink-3 uppercase">
              Brief the engine will use
            </span>
            <p className="text-[12.5px] leading-relaxed text-ink-2">
              <span className="text-ink">Voice.</span> {brand.voice}
            </p>
            <p className="text-[12.5px] leading-relaxed text-ink-2">
              <span className="text-ink">Style.</span> {brand.writingStyle}
            </p>
            <span className="flex flex-wrap items-center gap-1.5 pt-1">
              {brand.contentPillars.map((pillar) => (
                <Badge key={pillar} tone="neutral" size="sm">
                  {pillar}
                </Badge>
              ))}
            </span>
          </div>
        </div>
      )}
    </Modal>
  );
}
