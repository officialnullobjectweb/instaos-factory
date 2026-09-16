import { getBrand } from "@/data/brands";
import {
  COMPOSED_CONTRACT,
  STEP_CONTRACTS,
  altTextPrompt,
  captionPrompt,
  carouselPrompt,
  composePrompt,
  hashtagsPrompt,
  qualityPrompt,
  researchPrompt,
  topicPrompt,
  verifyPrompt,
} from "@/lib/prompts";
import {
  altTextOutputSchema,
  captionOutputSchema,
  carouselOutputSchema,
  expandQuality,
  generationPayloadSchema,
  hashtagsOutputSchema,
  qualityOutputSchema,
  researchOutputSchema,
  topicOutputSchema,
  verifyOutputSchema,
} from "@/lib/ai/schema";
import {
  guidanceForBrand,
  resolveTopicKey,
  type TopicGuidance,
} from "@/lib/insights/weighting";
import { appendAudit } from "@/lib/repositories/audit-repository";
import { createPost } from "@/lib/repositories/posts-repository";
import { getTopicWeights } from "@/lib/repositories/learning-repository";
import { notifyPostPending } from "@/lib/telegram";
import { qualityVerdict } from "@/lib/status";
import type {
  AiStepId,
  AiUsage,
  BrandId,
  ContentFormat,
  GenerationLogEntry,
  Post,
  PostCategory,
  PostVersion,
  QualityReport,
  Slide,
  SourceRef,
} from "@/types";

import { updateJob, updateStep } from "./jobs";
import { runStep, type RunStepResult } from "./manager";
import { AI_ENV } from "./providers";

/**
 * The generation flow.
 *
 * topic → research → verify facts → carousel → caption → hashtags → alt text →
 * quality score, then a `pending_review` post lands in the queue.
 *
 * Fact-checking is not decoration: claims the verifier rejects never reach the
 * carousel prompt, and anything that was dropped becomes a blocker in the
 * quality report, so a reviewer sees it in the drawer before approving.
 */

/** Whoever pressed generate owns the draft. */
const DEFAULT_OWNER = "Kamal Dhiver";

const DEFAULT_TEMPLATES: Record<ContentFormat, string> = {
  carousel: "tpl-carousel-story",
  reel: "tpl-reel-teaser",
  static: "tpl-editorial-quote",
  story: "tpl-story-tease",
};

export interface GenerationInput {
  brandId: BrandId;
  category?: PostCategory;
  /** Free-text steer from the person pressing the button. */
  steer?: string;
  /** Run the five compose steps as separate calls (default: AI_GRANULAR_STEPS). */
  granular?: boolean;
  owner?: string;
  /** Experiment metadata, stamped onto the post so results can be attributed. */
  subNicheId?: string;
  variantId?: string;
  audienceId?: string;
}

export interface GenerationOutcome {
  post: Post;
  provider: string;
  model: string;
  repairs: string[];
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

/** Marks a step running, runs it, and records the outcome either way. */
async function runTrackedStep<T>(
  jobId: string,
  id: AiStepId,
  run: () => Promise<RunStepResult<T>>,
  describe: (result: RunStepResult<T>) => string,
): Promise<RunStepResult<T>> {
  updateStep(jobId, id, { status: "running" });
  updateJob(jobId, { status: "running" });

  try {
    const result = await run();
    updateStep(jobId, id, {
      status: "success",
      attempts: result.attempts,
      detail: describe(result),
    });
    return result;
  } catch (error) {
    updateStep(jobId, id, {
      status: "failed",
      detail: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

function skipStep(jobId: string, id: AiStepId, detail: string) {
  updateStep(jobId, id, {
    status: "skipped",
    detail,
    finishedAt: new Date().toISOString(),
  });
}

/** The cover slide carries the hook; a carousel without one is invalid. */
function withCover(
  hook: string,
  slides: Array<{
    kind: Slide["kind"];
    kicker: string;
    headline: string;
    body: string;
    footnote?: string | null;
  }>,
): Slide[] {
  const normalised = slides.map((slide) => ({ ...slide }));

  const first = normalised[0];
  if (first && first.kind !== "cover") {
    normalised.unshift({
      kind: "cover",
      kicker: first.kicker,
      headline: hook,
      body: first.body,
      footnote: first.footnote ?? null,
    });
  }

  return normalised.map((slide, index) => ({
    id: `slide-${index + 1}`,
    index,
    kind: slide.kind,
    kicker: slide.kicker,
    headline: slide.headline,
    body: slide.body,
    footnote: slide.footnote ?? undefined,
  }));
}

function hostnameOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "unknown source";
  }
}

function toSources(
  references: Array<{
    title: string;
    publisher: string;
    url: string;
    credibility: SourceRef["credibility"];
  }>,
  grounded: Array<{ title: string; url: string; publisher: string | null }>,
): SourceRef[] {
  const accessedAt = new Date().toISOString();

  const fromModel = references.map((reference, index) => ({
    id: `ref-${index + 1}`,
    title: reference.title,
    publisher: reference.publisher,
    url: reference.url,
    credibility: reference.credibility,
    accessedAt,
  }));

  // Grounded citations come from the provider's own search results. They are
  // added whenever the model did not return a usable URL for that source.
  const knownUrls = new Set(fromModel.map((source) => source.url));
  const fromGrounding = grounded
    .filter((source) => source.url !== "" && !knownUrls.has(source.url))
    .slice(0, 6)
    .map((source, index) => ({
      id: `ref-g${index + 1}`,
      title: source.title || source.url,
      publisher: source.publisher ?? hostnameOf(source.url),
      url: source.url,
      credibility: "high" as const,
      accessedAt,
    }));

  return [...fromModel, ...fromGrounding];
}

function mergeHashtags(brandTags: string[], generated: string[]) {
  const merged = [...brandTags, ...generated].map((tag) =>
    tag.startsWith("#") ? tag : `#${tag}`,
  );
  return [...new Set(merged)].slice(0, 12);
}

export async function runGeneration(
  jobId: string,
  input: GenerationInput,
): Promise<GenerationOutcome> {
  const brand = getBrand(input.brandId);
  const category = input.category ?? brand.category;
  const granular = input.granular ?? AI_ENV.granularSteps;
  const nowIso = new Date().toISOString();
  const startedAt = Date.now();
  const hintBase = { brandId: brand.id, granular };

  const logs: GenerationLogEntry[] = [];
  const repairs = new Set<string>();

  let providerLabel = "unknown";
  let modelLabel = "unknown";
  let tokens = 0;

  const collect = (result: RunStepResult<unknown>) => {
    providerLabel = result.provider.label;
    modelLabel = result.provider.model;
    result.repairs.forEach((repair) => repairs.add(repair));
    tokens += result.usage?.totalTokens ?? 0;
  };

  /* ----------------------------- 1. Topic ----------------------------- */

  // The learning engine's weights, applied at the decision point rather than
  // after it: the model is told what has worked and picks inside that, so the
  // feedback loop changes what gets written instead of just what gets reported.
  let guidance: TopicGuidance | undefined;
  try {
    const weights = await getTopicWeights();
    if (weights.length > 0) guidance = guidanceForBrand(brand.id, weights);
  } catch {
    // An unreadable learning file must never block generation.
    guidance = undefined;
  }

  const topicStep = await runTrackedStep(
    jobId,
    "topic",
    () =>
      runStep({
        step: "topic",
        schema: topicOutputSchema,
        contract: STEP_CONTRACTS.topic,
        prompt: topicPrompt({
          brandId: brand.id,
          category,
          steer: input.steer,
          guidance,
          nowIso,
        }),
        hint: { ...hintBase, step: "topic" },
        jobId,
        maxOutputTokens: 1024,
      }),
    (result) => `${result.value.topic} · ${result.provider.label}`,
  );
  const topic = topicStep.value;
  collect(topicStep);
  // The sub-niche this post belongs to: the model's own answer when it named
  // one of the brand's directions, otherwise the brand's strongest measured
  // topic. Stamping it is what lets next week's analysis attribute the result.
  const topicKey =
    input.subNicheId ??
    resolveTopicKey({
      brandId: brand.id,
      modelTopicKey: topic.topicKey,
      guidance: guidance ?? guidanceForBrand(brand.id, []),
    });

  logs.push(
    logEntry({
      step: "brief",
      provider: topicStep.provider.label,
      model: topicStep.provider.model,
      message: `Brief: ${topic.topic} — pillar “${topic.pillar}”. ${topic.rationale}${
        topicKey ? ` Weighted topic: ${topicKey}.` : ""
      }`,
      durationMs: topicStep.latencyMs,
      status: "success",
      tokens: topicStep.usage?.totalTokens ?? 0,
    }),
  );

  /* ---------------------------- 2. Research --------------------------- */
  const researchStep = await runTrackedStep(
    jobId,
    "research",
    () =>
      runStep({
        step: "research",
        schema: researchOutputSchema,
        contract: STEP_CONTRACTS.research,
        prompt: researchPrompt({ brandId: brand.id, topic }),
        hint: { ...hintBase, step: "research", topic: topic.topic },
        jobId,
        grounding: true,
        maxOutputTokens: 4096,
      }),
    (result) =>
      `${result.value.facts.length} facts${
        result.grounded ? ` · grounded in ${result.sources.length} sources` : " · ungrounded"
      }`,
  );
  const research = researchStep.value;
  collect(researchStep);
  logs.push(
    logEntry({
      step: "research",
      provider: researchStep.provider.label,
      model: researchStep.provider.model,
      message: `${research.facts.length} facts collected${
        researchStep.grounded
          ? ` from ${researchStep.sources.length} grounded sources`
          : " without web grounding — treat every number as unverified"
      }.${research.gaps.length > 0 ? ` Gaps: ${research.gaps.join(" ")}` : ""}`,
      durationMs: researchStep.latencyMs,
      status: researchStep.grounded ? "success" : "warning",
      tokens: researchStep.usage?.totalTokens ?? 0,
    }),
  );

  /* -------------------------- 3. Verify facts ------------------------- */
  const verifyStep = await runTrackedStep(
    jobId,
    "verify",
    () =>
      runStep({
        step: "verify",
        schema: verifyOutputSchema,
        contract: STEP_CONTRACTS.verify,
        prompt: verifyPrompt({ brandId: brand.id, research }),
        hint: { ...hintBase, step: "verify", topic: topic.topic },
        jobId,
        maxOutputTokens: 2048,
      }),
    (result) =>
      `${result.value.claims.length} claims checked · ${result.value.rejected.length} rejected`,
  );
  const verification = verifyStep.value;
  collect(verifyStep);
  logs.push(
    logEntry({
      step: "verify",
      provider: verifyStep.provider.label,
      model: verifyStep.provider.model,
      message:
        verification.rejected.length === 0
          ? `All ${verification.claims.length} claims corroborated.`
          : `${verification.rejected.length} claim(s) rejected and excluded from the carousel: ${verification.rejected.join(" | ")}`,
      durationMs: verifyStep.latencyMs,
      status: verification.rejected.length === 0 ? "success" : "warning",
      tokens: verifyStep.usage?.totalTokens ?? 0,
    }),
  );

  /* ----------------------- 4–8. Compose the post ---------------------- */
  let carousel: {
    title: string;
    hook: string;
    slides: Array<{
      kind: Slide["kind"];
      kicker: string;
      headline: string;
      body: string;
      footnote?: string | null;
    }>;
  };
  let caption: string;
  let hashtags: string[];
  let altText: string;
  let quality: QualityReport;
  let references: Array<{
    title: string;
    publisher: string;
    url: string;
    credibility: SourceRef["credibility"];
  }> = [];

  const grounded = researchStep.grounded;
  const groundingSources = researchStep.sources;

  if (granular) {
    const carouselStep = await runTrackedStep(
      jobId,
      "carousel",
      () =>
        runStep({
          step: "carousel",
          schema: carouselOutputSchema,
          contract: STEP_CONTRACTS.carousel,
          prompt: carouselPrompt({ brandId: brand.id, topic, research, verification }),
          hint: { ...hintBase, step: "carousel", topic: topic.topic },
          jobId,
          maxOutputTokens: 4096,
        }),
      (result) => `${result.value.slides.length} slides · “${result.value.hook}”`,
    );
    carousel = carouselStep.value;
    collect(carouselStep);
    logs.push(
      logEntry({
        step: "carousel",
        provider: carouselStep.provider.label,
        model: carouselStep.provider.model,
        message: `Built ${carousel.slides.length} slides using verified facts only. Cover line: “${carousel.hook}”.`,
        durationMs: carouselStep.latencyMs,
        status: "success",
        tokens: carouselStep.usage?.totalTokens ?? 0,
      }),
    );

    const captionStep = await runTrackedStep(
      jobId,
      "caption",
      () =>
        runStep({
          step: "caption",
          schema: captionOutputSchema,
          contract: STEP_CONTRACTS.caption,
          prompt: captionPrompt({ brandId: brand.id, topic, carousel }),
          hint: { ...hintBase, step: "caption", topic: topic.topic },
          jobId,
          maxOutputTokens: 2048,
        }),
      (result) => `${result.value.caption.split(/\s+/).length} words`,
    );
    caption = captionStep.value.caption;
    collect(captionStep);
    logs.push(
      logEntry({
        step: "caption",
        provider: captionStep.provider.label,
        model: captionStep.provider.model,
        message: `Caption written: ${caption.split(/\s+/).length} words, opening line “${caption.split("\n")[0].slice(0, 90)}”.`,
        durationMs: captionStep.latencyMs,
        status: "success",
        tokens: captionStep.usage?.totalTokens ?? 0,
      }),
    );

    const hashtagsStep = await runTrackedStep(
      jobId,
      "hashtags",
      () =>
        runStep({
          step: "hashtags",
          schema: hashtagsOutputSchema,
          contract: STEP_CONTRACTS.hashtags,
          prompt: hashtagsPrompt({ brandId: brand.id, topic, title: carousel.title }),
          hint: { ...hintBase, step: "hashtags", topic: topic.topic },
          jobId,
          maxOutputTokens: 512,
        }),
      (result) => `${result.value.hashtags.length} tags`,
    );
    hashtags = hashtagsStep.value.hashtags;
    collect(hashtagsStep);
    logs.push(
      logEntry({
        step: "hashtags",
        provider: hashtagsStep.provider.label,
        model: hashtagsStep.provider.model,
        message: `Selected ${hashtags.length} tags: ${hashtags.join(" ")}`,
        durationMs: hashtagsStep.latencyMs,
        status: "success",
        tokens: hashtagsStep.usage?.totalTokens ?? 0,
      }),
    );

    const altStep = await runTrackedStep(
      jobId,
      "alt_text",
      () =>
        runStep({
          step: "alt_text",
          schema: altTextOutputSchema,
          contract: STEP_CONTRACTS.alt_text,
          prompt: altTextPrompt({ brandId: brand.id, carousel }),
          hint: { ...hintBase, step: "alt_text", topic: topic.topic },
          jobId,
          maxOutputTokens: 1024,
        }),
      (result) => `${result.value.altText.split(/\s+/).length} words`,
    );
    altText = altStep.value.altText;
    collect(altStep);
    logs.push(
      logEntry({
        step: "alt_text",
        provider: altStep.provider.label,
        model: altStep.provider.model,
        message: `Alt text covers all ${carousel.slides.length} frames.`,
        durationMs: altStep.latencyMs,
        status: "success",
        tokens: altStep.usage?.totalTokens ?? 0,
      }),
    );

    const qualityStep = await runTrackedStep(
      jobId,
      "quality",
      () =>
        runStep({
          step: "quality",
          schema: qualityOutputSchema,
          contract: STEP_CONTRACTS.quality,
          prompt: qualityPrompt({
            brandId: brand.id,
            payload: { ...carousel, caption, hashtags, altText },
            verification,
          }),
          hint: { ...hintBase, step: "quality", topic: topic.topic },
          jobId,
          maxOutputTokens: 2048,
        }),
      (result) => `${Math.round(result.value.score)}/100`,
    );
    collect(qualityStep);

    const report = expandQuality(qualityStep.value);
    quality = { ...report, verdict: qualityVerdict(report.score) };
  } else {
    const composeStep = await runTrackedStep(
      jobId,
      "carousel",
      () =>
        runStep({
          step: "carousel",
          schema: generationPayloadSchema,
          contract: COMPOSED_CONTRACT,
          prompt: composePrompt({ brandId: brand.id, topic, research, verification }),
          hint: { ...hintBase, step: "carousel", topic: topic.topic },
          jobId,
          maxOutputTokens: 8192,
        }),
      (result) => `complete draft · ${result.value.slides.length} slides`,
    );

    const payload = composeStep.value;
    collect(composeStep);

    carousel = payload;
    caption = payload.caption;
    hashtags = payload.hashtags;
    altText = payload.altText;
    references = payload.references;

    const report = expandQuality(payload.qualityScore);
    quality = { ...report, verdict: qualityVerdict(report.score) };

    const shared =
      "Produced inside the carousel step because AI_GRANULAR_STEPS=false — the model returns one structured payload per post.";
    skipStep(jobId, "caption", shared);
    skipStep(jobId, "hashtags", shared);
    skipStep(jobId, "alt_text", shared);
    skipStep(jobId, "quality", shared);
  }

  /* ------------------------ Map onto the queue ------------------------ */
  const slides = withCover(carousel.hook, carousel.slides);

  const blockers = [...quality.blockers];
  if (verification.rejected.length > 0) {
    blockers.unshift(
      `${verification.rejected.length} claim(s) were rejected during fact-checking and are not in this post.`,
    );
  }
  if (!grounded) {
    blockers.push(
      "Research was not grounded in live sources — verify every number before approving.",
    );
  }

  const finalQuality: QualityReport = {
    ...quality,
    blockers: [...new Set(blockers)],
    verdict: qualityVerdict(quality.score),
  };

  logs.push(
    logEntry({
      step: "quality",
      provider: providerLabel,
      model: modelLabel,
      message: `Scored ${finalQuality.score}/100 (${finalQuality.verdict})${
        finalQuality.blockers.length > 0
          ? ` with ${finalQuality.blockers.length} blocker(s).`
          : " with no blockers."
      }`,
      durationMs: 0,
      status: finalQuality.blockers.length > 0 ? "warning" : "success",
      tokens: 0,
    }),
    logEntry({
      step: "schedule",
      provider: providerLabel,
      model: modelLabel,
      message: `Queued for review in ${Math.round((Date.now() - startedAt) / 1000)}s across ${
        granular ? 8 : 4
      } pipeline steps.${repairs.size > 0 ? ` Repairs applied: ${[...repairs].join(", ")}.` : " No repairs were needed."}`,
      durationMs: Date.now() - startedAt,
      status: "success",
      tokens,
    }),
  );

  const sources = toSources(references, grounded ? groundingSources : []);
  const finalHashtags = mergeHashtags(brand.hashtagBase, hashtags);

  const draft: Post = {
    id: "",
    title: carousel.title,
    caption,
    brandId: brand.id,
    templateId: DEFAULT_TEMPLATES.carousel,
    status: "pending_review",
    format: "carousel",
    priority: "normal",
    scheduledFor: null,
    createdAt: nowIso,
    updatedAt: nowIso,
    assetCount: slides.length,
    tags: [
      ...new Set([
        topic.pillar.toLowerCase(),
        category.toLowerCase(),
        brand.id,
        ...(topicKey ? [`sub:${topicKey}`] : []),
        ...(input.variantId ? [`variant:${input.variantId}`] : []),
        ...(input.audienceId ? [`aud:${input.audienceId}`] : []),
      ]),
    ],
    owner: input.owner ?? DEFAULT_OWNER,
    category,
    quality: finalQuality,
    slides,
    hashtags: finalHashtags,
    altText,
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
        summary: `Generated by ${providerLabel} (${modelLabel}) — ${topic.topic}`,
        snapshot: {
          title: carousel.title,
          caption,
          hashtags: [...finalHashtags],
          altText,
          slides: slides.map((slide) => ({ ...slide })),
        },
      } satisfies PostVersion,
    ],
    generatedAt: nowIso,
    publishedAt: null,
    failureReason: null,
    retryCount: 0,
  };

  const post = await createPost(draft);

  // The activity trail starts here: creation is an audited event like every
  // other transition, so the dashboard timeline shows what the factory did
  // without a separate activity store.
  void appendAudit({
    action: "created",
    entityType: "post",
    entityId: post.id,
    postTitle: post.title,
    actor: { name: "Factory Engine", email: "engine@factory.os" },
    detail: `Generated by ${providerLabel} (${modelLabel}) — ${topic.topic}`,
  });

  updateJob(jobId, {
    status: "succeeded",
    postId: post.id,
    finishedAt: new Date().toISOString(),
  });

  // Every freshly generated post waits on a human: ping the configured
  // Telegram chat so the reviewer can act without opening the dashboard.
  void notifyPostPending(post);

  return {
    post,
    provider: providerLabel,
    model: modelLabel,
    repairs: [...repairs],
    totalTokens: tokens,
  };
}

export type { AiUsage };
