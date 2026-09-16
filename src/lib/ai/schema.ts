import { z } from "zod";

/**
 * The strict contract every provider must satisfy.
 *
 * Prompts ask for this shape, providers are given a JSON mode where they support
 * one, and Zod is the only thing that decides whether a payload is usable. Zod
 * strips unknown keys by default, so a chatty model that adds `"notes"` is
 * tolerated — but a missing slide or a caption that is not a string is not.
 */

/* -------------------------------------------------------------------------- */
/*  Step 1 — topic                                                            */
/* -------------------------------------------------------------------------- */

export const topicOutputSchema = z.object({
  topic: z.string().min(8).max(200),
  angle: z.string().min(8).max(400),
  pillar: z.string().min(2).max(60),
  /**
   * Which of the brand's sub-niches this topic belongs to.
   *
   * Optional on purpose: it is the join key that lets the learning engine
   * attribute a post's results back to the direction that produced it, but a
   * model that omits it must not fail the step — the caller falls back to the
   * brand's strongest measured topic.
   */
  topicKey: z.string().min(2).max(60).optional(),
  /** Why this is worth posting now, used in the generation log. */
  rationale: z.string().min(8).max(600),
});

export type TopicOutput = z.infer<typeof topicOutputSchema>;

/* -------------------------------------------------------------------------- */
/*  Step 2 — research                                                         */
/* -------------------------------------------------------------------------- */

export const researchFactSchema = z.object({
  claim: z.string().min(8).max(400),
  evidence: z.string().min(8).max(800),
  sourceTitle: z.string().min(2).max(200),
  sourceUrl: z.string().url().or(z.literal("")),
  publisher: z.string().min(2).max(120),
  /** The model's own confidence, before the verification pass. */
  confidence: z.enum(["high", "medium", "low"]),
});

export const researchOutputSchema = z.object({
  facts: z.array(researchFactSchema).min(3).max(12),
  gaps: z.array(z.string().max(300)).max(6).default([]),
});

export type ResearchOutput = z.infer<typeof researchOutputSchema>;

/* -------------------------------------------------------------------------- */
/*  Step 3 — verification                                                     */
/* -------------------------------------------------------------------------- */

export const verifyOutputSchema = z.object({
  claims: z
    .array(
      z.object({
        claim: z.string().min(4).max(400),
        verdict: z.enum(["supported", "unsupported", "uncertain"]),
        rationale: z.string().min(4).max(600),
      }),
    )
    .min(1)
    .max(12),
  /** Claims the verifier says must not ship, quoted so the caller can match. */
  rejected: z.array(z.string().max(400)).max(8).default([]),
});

export type VerifyOutput = z.infer<typeof verifyOutputSchema>;

/* -------------------------------------------------------------------------- */
/*  Step 4 — carousel                                                         */
/* -------------------------------------------------------------------------- */

export const slideKindSchema = z.enum([
  "cover",
  "statement",
  "list",
  "statistic",
  "quote",
  "cta",
]);

export const slideSchema = z.object({
  kind: slideKindSchema,
  kicker: z.string().max(60).default(""),
  headline: z.string().min(3).max(120),
  body: z.string().max(280).default(""),
  footnote: z.string().max(120).nullish(),
});

export const carouselOutputSchema = z.object({
  title: z.string().min(8).max(160),
  /** The opening line — becomes the cover headline. */
  hook: z.string().min(8).max(160),
  slides: z.array(slideSchema).min(3).max(10),
});

export type CarouselOutput = z.infer<typeof carouselOutputSchema>;

/* -------------------------------------------------------------------------- */
/*  Steps 5–8 — caption, hashtags, alt text, quality                          */
/* -------------------------------------------------------------------------- */

export const captionOutputSchema = z.object({
  caption: z.string().min(40).max(2200),
});

export const hashtagsOutputSchema = z.object({
  hashtags: z
    .array(z.string().min(2).max(40))
    .min(3)
    .max(15)
    // Models sometimes omit the leading "#" or emit duplicates.
    .transform((tags) =>
      [...new Set(tags.map((tag) => (tag.startsWith("#") ? tag : `#${tag}`)))].slice(0, 15),
    ),
});

export const altTextOutputSchema = z.object({
  altText: z.string().min(20).max(1000),
});

export const qualityCriterionSchema = z.object({
  id: z.string().min(2).max(40),
  label: z.string().min(2).max(60),
  /** Share of the total score, 0–1. */
  weight: z.coerce.number().min(0).max(1),
  score: z.coerce.number().min(0).max(100),
  note: z.string().min(2).max(400),
});

export const qualityOutputSchema = z.object({
  score: z.coerce.number().min(0).max(100),
  summary: z.string().min(8).max(600),
  criteria: z.array(qualityCriterionSchema).min(3).max(8),
  blockers: z.array(z.string().max(300)).max(6).default([]),
});

export type QualityOutput = z.infer<typeof qualityOutputSchema>;

/* -------------------------------------------------------------------------- */
/*  Composed payload — one call producing every field at once                 */
/* -------------------------------------------------------------------------- */

export const referenceSchema = z.object({
  title: z.string().min(2).max(200),
  publisher: z.string().min(2).max(120),
  url: z.string().min(4).max(500),
  credibility: z.enum(["high", "medium", "low"]),
});

export const generationPayloadSchema = carouselOutputSchema.extend({
  caption: z.string().min(40).max(2200),
  hashtags: z.array(z.string().min(2).max(40)).min(3).max(15),
  altText: z.string().min(20).max(1000),
  references: z.array(referenceSchema).max(10).default([]),
  qualityScore: qualityOutputSchema,
});

export type GenerationPayload = z.infer<typeof generationPayloadSchema>;

/* -------------------------------------------------------------------------- */
/*  Locally computed quality: used when a provider omits criteria             */
/* -------------------------------------------------------------------------- */

export const QUALITY_CRITERIA = [
  { id: "hook", label: "Hook strength", weight: 0.25 },
  { id: "clarity", label: "Caption clarity", weight: 0.25 },
  { id: "visual", label: "Visual consistency", weight: 0.2 },
  { id: "hashtags", label: "Hashtag coverage", weight: 0.15 },
  { id: "alt", label: "Alt text quality", weight: 0.15 },
] as const;

/**
 * Fills in a criteria breakdown when only a headline score survives validation,
 * so the quality report is never empty.
 */
export function expandQuality(
  partial: Partial<QualityOutput> & { score: number },
): QualityOutput {
  const provided = partial.criteria ?? [];
  const missing = QUALITY_CRITERIA.filter(
    (criterion) => !provided.some((entry) => entry.id === criterion.id),
  );

  const criteria = [
    ...provided,
    ...missing.map((criterion) => ({
      id: criterion.id,
      label: criterion.label,
      weight: criterion.weight,
      score: Math.round(partial.score),
      note: "Scored from the overall quality result — no per-criterion detail was returned.",
    })),
  ];

  return {
    score: Math.max(0, Math.min(100, Math.round(partial.score))),
    summary: partial.summary ?? `Weighted score ${Math.round(partial.score)} out of 100.`,
    criteria,
    blockers: partial.blockers ?? [],
  };
}
