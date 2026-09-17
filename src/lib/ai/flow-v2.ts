import { getBrand } from "@/data/brands";
import {
  topicScoringPrompt,
  researchPrompt,
  contentWritingPrompt,
  designSelectionPrompt,
  qualityScoringPrompt,
  hashtagPrompt,
  captionWritingPrompt,
} from "./prompts-v2";
import {
  rankCandidates,
  calculateTotalScore,
  isAcceptable,
  type TopicCandidate,
  type TopicScores,
} from "./topic-scoring";
import { appendAudit } from "@/lib/repositories/audit-repository";
import { createPost, listPosts } from "@/lib/repositories/posts-repository";
import { notifyPostPending } from "@/lib/telegram";
import type {
  BrandId,
  GenerationLogEntry,
  Post,
  PostVersion,
  QualityReport,
  Slide,
  SourceRef,
} from "@/types";

import { runStep, type RunStepResult } from "./manager";

/**
 * Enhanced Generation Flow v2
 *
 * 1. Topic Scoring (70% effort) — generate 8 candidates, score, pick best
 * 2. Deep Research — trusted sources, multiple viewpoints, critiques
 * 3. Content Writing — visual-first, simple, engaging
 * 4. Design Selection — match content to best visual approach
 * 5. Quality Review — score and approve/reject
 * 6. Final Polish — hashtags, caption, alt text
 */

const DEFAULT_OWNER = "Kamal Dhiver";

export interface GenerationInput {
  brandId: BrandId;
  steer?: string;
  owner?: string;
}

export interface GenerationOutcome {
  post: Post;
  provider: string;
  model: string;
  totalTokens: number;
}

function logEntry(input: {
  step: GenerationLogEntry["step"];
  provider: string;
  model: string;
  message: string;
  durationMs: number;
  status: GenerationLogEntry["status"];
  tokens: number;
}): GenerationLogEntry {
  return {
    id: `log-${input.step}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    step: input.step,
    status: input.status,
    message: input.message,
    durationMs: input.durationMs,
    timestamp: new Date().toISOString(),
    model: `${input.provider} · ${input.model}`,
    tokens: input.tokens,
  };
}

function hostnameOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "unknown source";
  }
}

/** Get existing topics to avoid */
async function getAvoidTopics(brandId: BrandId): Promise<string[]> {
  try {
    const existing = await listPosts();
    return existing
      .filter((post) => post.brandId === brandId)
      .slice(0, 40)
      .map((post) => post.title);
  } catch {
    return [];
  }
}

/** Convert research sources to SourceRef[] */
function toSources(
  facts: Array<{ claim: string; source: string; year: number; credibility: string }>,
): SourceRef[] {
  const accessedAt = new Date().toISOString();
  return facts.map((f, i) => ({
    id: `ref-${i + 1}`,
    title: f.claim.slice(0, 100),
    publisher: f.source,
    url: "",
    credibility: f.credibility as SourceRef["credibility"],
    accessedAt,
  }));
}

/**
 * Main generation flow v2
 */
export async function runGenerationV2(
  jobId: string,
  input: GenerationInput,
): Promise<GenerationOutcome> {
  const brand = getBrand(input.brandId);
  const nowIso = new Date().toISOString();
  const startedAt = Date.now();

  const logs: GenerationLogEntry[] = [];
  let providerLabel = "unknown";
  let modelLabel = "unknown";
  let tokens = 0;

  const collect = (result: RunStepResult<unknown>) => {
    providerLabel = result.provider.label;
    modelLabel = result.provider.model;
    tokens += result.usage?.totalTokens ?? 0;
  };

  /* ==================== STEP 1: Topic Scoring (70% effort) ==================== */

  const avoidTopics = await getAvoidTopics(brand.id);
  const topicPrompt = topicScoringPrompt(brand.id, brand.category, avoidTopics);

  const topicStep = await runStep({
    step: "topic",
    schema: topicScoringSchema,
    contract: "Topic scoring output with candidates",
    prompt: topicPrompt,
    hint: { brandId: brand.id, step: "topic", avoid: avoidTopics },
    jobId,
    maxOutputTokens: 4096,
  });
  collect(topicStep);

  // Rank candidates and pick the best
  const ranked = rankCandidates(brand.id, topicStep.value.candidates);
  const bestCandidate = ranked[0];

  if (!bestCandidate || !isAcceptable(bestCandidate.totalScore)) {
    throw new Error(
      `No topic met the minimum score of ${6.5}. Best: ${bestCandidate?.topic ?? "none"} (${bestCandidate?.totalScore ?? 0}/10)`,
    );
  }

  logs.push(
    logEntry({
      step: "brief",
      provider: topicStep.provider.label,
      model: topicStep.provider.model,
      message: `Selected "${bestCandidate.topic}" (score: ${bestCandidate.totalScore}/10) from ${topicStep.value.candidates.length} candidates. Top 3: ${ranked.map((r) => `${r.topic} (${r.totalScore})`).join(", ")}.`,
      durationMs: topicStep.latencyMs,
      status: "success",
      tokens: topicStep.usage?.totalTokens ?? 0,
    }),
  );

  /* ==================== STEP 2: Deep Research ==================== */

  const researchPromptPair = researchPrompt(brand.id, bestCandidate.topic, bestCandidate.angle);

  const researchStep = await runStep({
    step: "research",
    schema: researchSchema,
    contract: "Research output with verified facts",
    prompt: researchPromptPair,
    hint: { brandId: brand.id, step: "research", topic: bestCandidate.topic },
    jobId,
    maxOutputTokens: 4096,
  });
  collect(researchStep);

  logs.push(
    logEntry({
      step: "research",
      provider: researchStep.provider.label,
      model: researchStep.provider.model,
      message: `Found ${researchStep.value.facts.length} facts, ${researchStep.value.counterArguments.length} counter-arguments, ${researchStep.value.statistics.length} statistics.`,
      durationMs: researchStep.latencyMs,
      status: "success",
      tokens: researchStep.usage?.totalTokens ?? 0,
    }),
  );

  /* ==================== STEP 3: Content Writing ==================== */

  const contentPrompt = contentWritingPrompt(
    brand.id,
    bestCandidate.topic,
    bestCandidate.angle,
    researchStep.value,
  );

  const contentStep = await runStep({
    step: "carousel",
    schema: contentSchema,
    contract: "Carousel content with slides",
    prompt: contentPrompt,
    hint: { brandId: brand.id, step: "carousel", topic: bestCandidate.topic },
    jobId,
    maxOutputTokens: 4096,
  });
  collect(contentStep);

  logs.push(
    logEntry({
      step: "carousel",
      provider: contentStep.provider.label,
      model: contentStep.provider.model,
      message: `Created ${contentStep.value.slides.length} slides. Hook: "${contentStep.value.hook}"`,
      durationMs: contentStep.latencyMs,
      status: "success",
      tokens: contentStep.usage?.totalTokens ?? 0,
    }),
  );

  /* ==================== STEP 4: Design Selection ==================== */

  const designPrompt = designSelectionPrompt(brand.id, contentStep.value.slides);

  const designStep = await runStep({
    step: "quality",
    schema: designSchema,
    contract: "Design selection",
    prompt: designPrompt,
    hint: { brandId: brand.id, step: "quality", topic: bestCandidate.topic },
    jobId,
    maxOutputTokens: 1024,
  });
  collect(designStep);

  logs.push(
    logEntry({
      step: "quality",
      provider: designStep.provider.label,
      model: designStep.provider.model,
      message: `Selected "${designStep.value.template}" design. ${designStep.value.rationale}`,
      durationMs: designStep.latencyMs,
      status: "success",
      tokens: designStep.usage?.totalTokens ?? 0,
    }),
  );

  /* ==================== STEP 5: Quality Review ==================== */

  const qualityPromptPair = qualityScoringPrompt(brand.id, contentStep.value);

  const qualityStep = await runStep({
    step: "quality",
    schema: qualityReviewSchema,
    contract: "Quality review scores",
    prompt: qualityPromptPair,
    hint: { brandId: brand.id, step: "quality", topic: bestCandidate.topic },
    jobId,
    maxOutputTokens: 1024,
  });
  collect(qualityStep);

  const qualityReview = qualityStep.value;
  const averageScore = qualityReview.averageScore;

  logs.push(
    logEntry({
      step: "quality",
      provider: qualityStep.provider.label,
      model: qualityStep.provider.model,
      message: `Score: ${averageScore}/10 (${qualityReview.verdict}). ${qualityReview.improvements.length} improvements suggested.`,
      durationMs: qualityStep.latencyMs,
      status: qualityReview.verdict === "approve" ? "success" : "warning",
      tokens: qualityStep.usage?.totalTokens ?? 0,
    }),
  );

  /* ==================== STEP 6: Final Polish ==================== */

  // Hashtags
  const hashtagPromptPair = hashtagPrompt(brand.id, contentStep.value.title, bestCandidate.topic);
  const hashtagStep = await runStep({
    step: "hashtags",
    schema: hashtagSchema,
    contract: "Hashtag list",
    prompt: hashtagPromptPair,
    hint: { brandId: brand.id, step: "hashtags", topic: bestCandidate.topic },
    jobId,
    maxOutputTokens: 512,
  });
  collect(hashtagStep);

  // Caption
  const captionPromptPair = captionWritingPrompt(
    brand.id,
    contentStep.value.title,
    contentStep.value.hook,
    contentStep.value.keyTakeaway,
  );
  const captionStep = await runStep({
    step: "caption",
    schema: captionSchema,
    contract: "Caption text",
    prompt: captionPromptPair,
    hint: { brandId: brand.id, step: "caption", topic: bestCandidate.topic },
    jobId,
    maxOutputTokens: 1024,
  });
  collect(captionStep);

  /* ==================== Build Final Post ==================== */

  const slides: Slide[] = contentStep.value.slides.map((s, i) => ({
    id: `slide-${i + 1}`,
    index: i,
    kind: s.kind as Slide["kind"],
    kicker: s.kicker,
    headline: s.headline,
    body: s.body,
    footnote: s.footnote ?? undefined,
  }));

  const sources = toSources(researchStep.value.facts);

  const qualityReport: QualityReport = {
    score: Math.round(averageScore * 10),
    verdict: averageScore >= 8 ? "excellent" : averageScore >= 7 ? "strong" : averageScore >= 6 ? "review" : "weak",
    summary: `Score: ${averageScore}/10. ${qualityReview.improvements.length} improvements suggested.`,
    criteria: [
      { id: "hook", label: "Hook Strength", score: qualityReview.scores.hookStrength * 10, weight: 0.15, note: "" },
      { id: "clarity", label: "Clarity", score: qualityReview.scores.clarity * 10, weight: 0.15, note: "" },
      { id: "visual", label: "Visual Potential", score: qualityReview.scores.visualPotential * 10, weight: 0.15, note: "" },
      { id: "facts", label: "Factual Accuracy", score: qualityReview.scores.factualAccuracy * 10, weight: 0.15, note: "" },
      { id: "brand", label: "Brand Alignment", score: qualityReview.scores.brandAlignment * 10, weight: 0.1, note: "" },
      { id: "engagement", label: "Engagement", score: qualityReview.scores.engagement * 10, weight: 0.15, note: "" },
      { id: "completeness", label: "Completeness", score: qualityReview.scores.completeness * 10, weight: 0.1, note: "" },
      { id: "originality", label: "Originality", score: qualityReview.scores.originality * 10, weight: 0.05, note: "" },
    ],
    blockers: qualityReview.blockers,
  };

  const finalHashtags = [...new Set([...brand.hashtagBase, ...hashtagStep.value.hashtags])].slice(0, 12);

  const draft: Post = {
    id: "",
    title: contentStep.value.title,
    caption: captionStep.value.caption,
    brandId: brand.id,
    templateId: `tpl-${designStep.value.template}`,
    status: "pending_review",
    format: "carousel",
    priority: "normal",
    scheduledFor: null,
    createdAt: nowIso,
    updatedAt: nowIso,
    assetCount: slides.length,
    tags: [
      bestCandidate.pillar.toLowerCase(),
      brand.category.toLowerCase(),
      brand.id,
    ],
    owner: input.owner ?? DEFAULT_OWNER,
    category: brand.category,
    quality: qualityReport,
    slides,
    hashtags: finalHashtags,
    altText: contentStep.value.slides.map((s) => s.headline).join(". "),
    sources,
    generationLogs: logs,
    versions: [
      {
        id: "version-1",
        number: 1,
        label: "Version 1",
        createdAt: nowIso,
        author: providerLabel,
        source: "generation",
        summary: `Generated by ${providerLabel} — ${bestCandidate.topic}`,
        snapshot: {
          title: contentStep.value.title,
          caption: captionStep.value.caption,
          hashtags: finalHashtags,
          altText: contentStep.value.slides.map((s) => s.headline).join(". "),
          slides: slides.map((s) => ({ ...s })),
        },
      } satisfies PostVersion,
    ],
    generatedAt: nowIso,
    publishedAt: null,
    failureReason: null,
    retryCount: 0,
  };

  const post = await createPost(draft);

  void appendAudit({
    action: "created",
    entityType: "post",
    entityId: post.id,
    postTitle: post.title,
    actor: { name: "Factory Engine", email: "engine@factory.os" },
    detail: `Generated by ${providerLabel} — ${bestCandidate.topic} (score: ${bestCandidate.totalScore}/10)`,
  });

  void notifyPostPending(post);

  return {
    post,
    provider: providerLabel,
    model: modelLabel,
    totalTokens: tokens,
  };
}

/* ==================== Zod Schemas ==================== */

import { z } from "zod";

const topicScoresSchema = z.object({
  novelty: z.number().min(0).max(10),
  engagement: z.number().min(0).max(10),
  brandFit: z.number().min(0).max(10),
  visualPotential: z.number().min(0).max(10),
  dataRichness: z.number().min(0).max(10),
  controversy: z.number().min(0).max(10),
  timeliness: z.number().min(0).max(10),
});

const topicCandidateSchema = z.object({
  topic: z.string().max(200),
  angle: z.string().max(300),
  pillar: z.string().max(100),
  rationale: z.string().max(400),
  scores: topicScoresSchema,
});

const topicScoringSchema = z.object({
  candidates: z.array(topicCandidateSchema).min(3).max(12),
});

const factSchema = z.object({
  claim: z.string(),
  source: z.string(),
  year: z.number(),
  credibility: z.enum(["high", "medium", "low"]),
});

const researchSchema = z.object({
  facts: z.array(factSchema).min(3),
  counterArguments: z.array(z.object({ claim: z.string(), source: z.string() })),
  statistics: z.array(z.object({ value: z.string(), context: z.string(), source: z.string(), year: z.number() })),
  surprising: z.string(),
  misconceptions: z.array(z.object({ myth: z.string(), reality: z.string() })),
  gaps: z.array(z.string()),
});

const slideSchema = z.object({
  kind: z.enum(["cover", "insight", "stat", "critique", "cta"]),
  kicker: z.string(),
  headline: z.string().max(100),
  body: z.string().max(300),
  visual: z.string().optional(),
  footnote: z.string().nullable().optional(),
});

const contentSchema = z.object({
  title: z.string().max(80),
  hook: z.string().max(150),
  slides: z.array(slideSchema).min(5).max(10),
  keyTakeaway: z.string().max(200),
});

const designSchema = z.object({
  template: z.enum(["editorial", "data-viz", "minimal", "bold", "illustrated"]),
  rationale: z.string(),
  colorOverrides: z.object({
    background: z.string(),
    foreground: z.string(),
    accent: z.string(),
  }).optional(),
  typographyNotes: z.string().optional(),
  slideDesigns: z.array(z.object({
    slideIndex: z.number(),
    layout: z.string(),
    visualNotes: z.string(),
  })).optional(),
});

const qualityReviewSchema = z.object({
  scores: z.object({
    hookStrength: z.number().min(0).max(10),
    clarity: z.number().min(0).max(10),
    visualPotential: z.number().min(0).max(10),
    factualAccuracy: z.number().min(0).max(10),
    brandAlignment: z.number().min(0).max(10),
    engagement: z.number().min(0).max(10),
    completeness: z.number().min(0).max(10),
    originality: z.number().min(0).max(10),
  }),
  averageScore: z.number(),
  verdict: z.enum(["approve", "revise", "reject"]),
  improvements: z.array(z.string()),
  blockers: z.array(z.string()),
});

const hashtagSchema = z.object({
  hashtags: z.array(z.string()).max(12),
});

const captionSchema = z.object({
  caption: z.string().max(2000),
});
