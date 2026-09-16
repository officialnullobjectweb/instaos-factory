import { getBrand } from "@/data/brands";
import { SUB_NICHES } from "@/design/sub-niches";
import type { BrandId, PostCategory, TopicWeight } from "@/types";

/**
 * Turns the learning engine's weights into guidance the generation engine can
 * use.
 *
 * This is the join between the two halves of the product: the learning report
 * says "Oceans & Chokepoints earns 1.45×", and this module decides that means
 * studio-noir should be steered toward `geo-oceans` and away from whichever of
 * its three sub-niches is underperforming.
 *
 * The key insight is that guidance is scoped to the brand. Weights are measured
 * across the whole workspace, but a psychology brand must never be told to
 * prefer a geography topic — so candidates come from the brand's own sub-niches
 * and unmatched weights are ignored rather than guessed at.
 */

const CATEGORY_TO_NICHE: Record<PostCategory, "geography" | "psychology" | "branding"> = {
  Geography: "geography",
  Psychology: "psychology",
  Branding: "branding",
};

/** Multiplier below which a topic is treated as underperforming. */
const AVOID_THRESHOLD = 0.95;

export interface TopicCandidate {
  id: string;
  label: string;
  multiplier: number;
  /** True when the measurement rests on enough posts to be worth acting on. */
  measured: boolean;
  posts: number;
  trend: TopicWeight["trend"] | "unknown";
}

export interface TopicGuidance {
  /** Every direction open to this brand, best first. */
  candidates: TopicCandidate[];
  preferred: TopicCandidate[];
  avoid: TopicCandidate[];
  /** False when no analysis has run — the prompt then says so, and says nothing else. */
  measured: boolean;
  /** One line describing the evidence, for the prompt and the generation log. */
  note: string;
}

/** A weight needs this many posts before it is used to steer anything. */
export const GUIDANCE_MIN_SAMPLE = 3;

export function guidanceForBrand(
  brandId: BrandId,
  weights: TopicWeight[],
): TopicGuidance {
  const brand = getBrand(brandId);
  const niche = CATEGORY_TO_NICHE[brand.category];

  const candidates: TopicCandidate[] = SUB_NICHES.filter(
    (subNiche) => subNiche.mainNiche === niche,
  ).map((subNiche) => {
    const weight = weights.find((entry) => entry.topicId === subNiche.id);
    return {
      id: subNiche.id,
      label: subNiche.label,
      multiplier: weight?.multiplier ?? 1,
      measured: (weight?.posts ?? 0) >= GUIDANCE_MIN_SAMPLE,
      posts: weight?.posts ?? 0,
      trend: weight?.trend ?? "unknown",
    };
  });

  const measuredCandidates = candidates.filter((candidate) => candidate.measured);

  return {
    candidates: [...candidates].sort((a, b) => b.multiplier - a.multiplier),
    preferred: measuredCandidates
      .filter((candidate) => candidate.multiplier > 1)
      .sort((a, b) => b.multiplier - a.multiplier)
      .slice(0, 2),
    avoid: measuredCandidates
      .filter((candidate) => candidate.multiplier < AVOID_THRESHOLD)
      .sort((a, b) => a.multiplier - b.multiplier)
      .slice(0, 1),
    measured: measuredCandidates.length > 0,
    note:
      measuredCandidates.length > 0
        ? `Measured across the last weekly analysis (${measuredCandidates.reduce((total, candidate) => total + candidate.posts, 0)} posts in this brand's sub-niches).`
        : "No performance analysis has run yet, so there is no weighting to apply.",
  };
}

/**
 * The sub-niche a generated post should be attributed to.
 *
 * Prefers the model's own answer when it names one of the brand's directions,
 * and otherwise falls back to the brand's strongest measured topic — so the
 * learning loop keeps working even with a model that ignores the field.
 */
export function resolveTopicKey(input: {
  brandId: BrandId;
  modelTopicKey?: string | null;
  guidance: TopicGuidance;
}): string | null {
  const { brandId, modelTopicKey, guidance } = input;
  const brand = getBrand(brandId);
  const niche = CATEGORY_TO_NICHE[brand.category];

  const valid = new Set(
    SUB_NICHES.filter((subNiche) => subNiche.mainNiche === niche).map(
      (subNiche) => subNiche.id,
    ),
  );

  if (modelTopicKey && valid.has(modelTopicKey)) return modelTopicKey;

  return guidance.candidates[0]?.id ?? null;
}
