import type { BrandId } from "@/types";

/**
 * Topic Scoring Engine — the brain of content selection.
 *
 * Generates candidates, scores them on multiple dimensions, and picks
 * the best one. This is where 70% of the quality happens.
 */

export interface TopicCandidate {
  topic: string;
  angle: string;
  pillar: string;
  rationale: string;
  scores: TopicScores;
  totalScore?: number; // Calculated by rankCandidates
}

export interface TopicScores {
  novelty: number;       // 0-10: How fresh/novel is this?
  engagement: number;    // 0-10: Will people stop scrolling?
  brandFit: number;      // 0-10: Does it match the brand voice?
  visualPotential: number; // 0-10: Can we make stunning slides?
  dataRichness: number;  // 0-10: Are there facts/stats to cite?
  controversy: number;   // 0-10: Does it spark debate?
  timeliness: number;    // 0-10: Is it timely/relevant?
}

/** Weighted scoring per brand — what matters most for each audience. */
const BRAND_WEIGHTS: Record<BrandId, Record<keyof TopicScores, number>> = {
  "studio-noir": {
    novelty: 1.5,
    engagement: 1.2,
    brandFit: 1.0,
    visualPotential: 1.3,
    dataRichness: 1.4,
    controversy: 0.8,
    timeliness: 1.0,
  },
  "midnight-ritual": {
    novelty: 1.3,
    engagement: 1.4,
    brandFit: 1.5,
    visualPotential: 1.0,
    dataRichness: 0.7,
    controversy: 1.2,
    timeliness: 0.9,
  },
  "daily-grind": {
    novelty: 1.2,
    engagement: 1.5,
    brandFit: 1.3,
    visualPotential: 1.1,
    dataRichness: 1.3,
    controversy: 1.0,
    timeliness: 1.4,
  },
};

/** Minimum total score to accept a topic (out of 10). */
const MINIMUM_SCORE = 6.5;

/** Maximum candidates to evaluate per brand. */
const CANDIDATE_COUNT = 8;

/** Number of top candidates to shortlist for final selection. */
const SHORTLIST_SIZE = 3;

export function calculateTotalScore(
  brandId: BrandId,
  scores: TopicScores,
): number {
  const weights = BRAND_WEIGHTS[brandId];
  let totalWeight = 0;
  let weightedSum = 0;

  for (const [key, weight] of Object.entries(weights)) {
    const score = scores[key as keyof TopicScores];
    weightedSum += score * weight;
    totalWeight += weight;
  }

  return Math.round((weightedSum / totalWeight) * 10) / 10;
}

export function isAcceptable(totalScore: number): boolean {
  return totalScore >= MINIMUM_SCORE;
}

export function rankCandidates(
  brandId: BrandId,
  candidates: TopicCandidate[],
): Array<TopicCandidate & { totalScore: number }> {
  return candidates
    .map((c) => ({
      ...c,
      totalScore: calculateTotalScore(brandId, c.scores),
    }))
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, SHORTLIST_SIZE);
}

export { CANDIDATE_COUNT, MINIMUM_SCORE, SHORTLIST_SIZE };
