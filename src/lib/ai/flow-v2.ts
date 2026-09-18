import { z } from "zod";

import { getBrand } from "@/data/brands";
import { appendAudit } from "@/lib/repositories/audit-repository";
import { createPost, listPosts } from "@/lib/repositories/posts-repository";
import { notifyPostPending } from "@/lib/telegram";
import type {
  AiStepId,
  BrandId,
  GenerationLogEntry,
  GenerationLogStatus,
  GenerationRun,
  GenerationStep,
  Post,
  PostVersion,
  QualityReport,
  Slide,
  SourceRef,
} from "@/types";

import { readArtifact, resumeCheckpoint, withArtifact } from "./checkpoint";
import { runStep, type RunStepResult } from "./manager";
import { AI_ENV } from "./providers";
import {
  captionWritingPrompt,
  contentWritingPrompt,
  designSelectionPrompt,
  hashtagPrompt,
  qualityScoringPrompt,
  researchPrompt,
  topicScoringPrompt,
} from "./prompts-v2";
import { isAcceptable, rankCandidates } from "./topic-scoring";
import { createRunTracker } from "./track";

/**
 * Generation flow v2.
 *
 * 1. Topic scoring — generate candidates, score them, take the strongest
 * 2. Deep research — facts, counter-arguments, statistics, gaps
 * 3. Carousel writing — visual-first slide copy
 * 4. Design selection — match the content to a visual direction
 * 5. Quality review — score it and list what to improve
 * 6. Final polish — caption, hashtags, alt text
 *
 * Every stage reports through one tracker, which writes three places at once: the
 * persisted run (what happened, including failures), the live job (what is
 * happening now) and the post's own generation log (what a reviewer reads next to
 * the content). Before this, only the post's log was written, and only for some
 * steps — so a run that failed was invisible everywhere.
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

/** Who did a stage, how long it took and what it cost — per stage, not per run. */
interface StepMeta {
  provider: string;
  model: string;
  durationMs: number;
  tokens: number;
  attempts: number;
  /** True when the stage was answered from a checkpoint instead of a model call. */
  reused: boolean;
}

function metaFrom(result: RunStepResult<unknown>): StepMeta {
  return {
    provider: result.provider.label,
    model: result.provider.model,
    durationMs: result.latencyMs,
    tokens: result.usage?.totalTokens ?? 0,
    attempts: result.attempts,
    reused: false,
  };
}

/**
 * The meta for a stage answered from a checkpoint.
 *
 * Named `checkpoint` rather than attributed to a provider: no model ran, and a
 * run report that claimed otherwise would make the token totals unreadable.
 */
function reusedMeta(): StepMeta {
  return {
    provider: "checkpoint",
    model: "earlier attempt",
    durationMs: 0,
    tokens: 0,
    attempts: 0,
    reused: true,
  };
}

function logEntry(input: {
  step: GenerationStep;
  provider: string;
  model: string;
  message: string;
  durationMs: number;
  status: GenerationLogStatus;
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
 * Main generation flow v2.
 *
 * Throws after recording the failure, so the route's fire-and-forget catch and
 * the run document both see it: the caller is told the job failed, and the queue
 * can show which step stopped it and why.
 */
export interface RunGenerationOptions {
  /**
   * An earlier failed run to continue. Its stored stage payloads are reused, so a
   * retry does not pay again for work that already succeeded.
   */
  resumeFrom?: GenerationRun | null;
  /** Tokens earlier attempts spent, carried so the run total stays truthful. */
  tokensCarried?: number;
}

export async function runGenerationV2(
  jobId: string,
  input: GenerationInput,
  options: RunGenerationOptions = {},
): Promise<GenerationOutcome> {
  const brand = getBrand(input.brandId);
  const nowIso = new Date().toISOString();

  const logs: GenerationLogEntry[] = [];
  const carried = resumeCheckpoint(options.resumeFrom ?? null);

  const tracker = await createRunTracker({
    jobId,
    brandId: brand.id,
    checkpoint: options.resumeFrom ? carried : null,
    tokensCarried: options.tokensCarried ?? 0,
    resumedFrom: options.resumeFrom?.id ?? null,
    // On a retry the original brief wins: the run being continued is the record of
    // what was asked for, and this attempt is finishing that job, not replacing it.
    request: {
      steer: options.resumeFrom?.request?.steer ?? input.steer ?? null,
      owner: options.resumeFrom?.request?.owner ?? input.owner ?? null,
    },
  });

  /** Stage payloads this attempt may reuse, and is adding to as it goes. */
  let checkpoint = carried;

  /** Stages answered from the checkpoint rather than by a model. */
  const reused: AiStepId[] = [];

  const saveArtifact = async (step: AiStepId, artifact: unknown) => {
    checkpoint = withArtifact(checkpoint, step, artifact);
    await tracker.saveCheckpoint(checkpoint);
  };

  /**
   * The run's wall-clock ceiling, fixed once.
   *
   * Every stage spends only what is left of it, which is what stops a nine-call
   * pipeline from outliving the deadline the queue is waiting on — and what makes
   * "the client gave up" and "the run is broken" two different statements.
   */
  const deadlineAt = Date.now() + AI_ENV.jobBudgetMs;

  let providerLabel = "unknown";
  let modelLabel = "unknown";
  let tokens = options.tokensCarried ?? 0;

  const collect = (result: RunStepResult<unknown>) => {
    providerLabel = result.provider.label;
    modelLabel = result.provider.model;
    tokens += result.usage?.totalTokens ?? 0;
  };

  try {
    /* ================== STEP 1: Topic scoring ================== */

    const avoidTopics = await getAvoidTopics(brand.id);
    const topicPrompt = topicScoringPrompt(brand.id, brand.category, avoidTopics);

    const topic = await tracker.step("topic", async () => {
      // The acceptance gate runs on both paths. A reused topic has to clear the
      // same bar as a fresh one, or a resumed run would publish something the
      // first attempt already refused.
      const checkpointed = readArtifact(checkpoint, "topic", topicScoringSchema);

      if (checkpointed) {
        const ranked = rankCandidates(brand.id, checkpointed.candidates);
        const best = ranked[0];

        if (!best || !isAcceptable(best.totalScore)) {
          throw new Error(
            `No topic met the minimum score of 6.5. Best: ${best?.topic ?? "none"} (${best?.totalScore ?? 0}/10)`,
          );
        }

        reused.push("topic");

        return {
          value: { data: { best, ranked }, meta: reusedMeta() },
          status: "skipped" as const,
          message: `Kept "${best.topic}" (score: ${best.totalScore}/10) from the earlier attempt — no model call, no tokens spent.`,
          model: null,
          durationMs: 0,
          tokens: 0,
          attempts: 0,
        };
      }

      const result = await runStep({
        step: "topic",
        schema: topicScoringSchema,
        contract: "Topic scoring output with candidates",
        prompt: topicPrompt,
        hint: { brandId: brand.id, step: "topic", avoid: avoidTopics },
        jobId,
        deadlineAt,
        maxOutputTokens: 4096,
      });

      // Ranking and the acceptance gate live inside the step: a run that picks no
      // usable topic failed *at topic selection*, and should say so.
      const ranked = rankCandidates(brand.id, result.value.candidates);
      const best = ranked[0];

      if (!best || !isAcceptable(best.totalScore)) {
        throw new Error(
          `No topic met the minimum score of 6.5. Best: ${best?.topic ?? "none"} (${best?.totalScore ?? 0}/10)`,
        );
      }

      const message = `Selected "${best.topic}" (score: ${best.totalScore}/10) from ${result.value.candidates.length} candidates. Top 3: ${ranked
        .slice(0, 3)
        .map((entry) => `${entry.topic} (${entry.totalScore})`)
        .join(", ")}.`;

      collect(result);
      await saveArtifact("topic", result.value);

      return {
        value: { data: { best, ranked }, meta: metaFrom(result) },
        message,
        model: `${result.provider.label} · ${result.provider.model}`,
        durationMs: result.latencyMs,
        tokens: result.usage?.totalTokens ?? 0,
        attempts: result.attempts,
      };
    });

    const bestCandidate = topic.data.best;
    logs.push(
      logEntry({
        step: "topic",
        provider: topic.meta.provider,
        model: topic.meta.model,
        message: topic.meta.reused
          ? `Kept "${bestCandidate.topic}" (score: ${bestCandidate.totalScore}/10) from the earlier attempt.`
          : `Selected "${bestCandidate.topic}" (score: ${bestCandidate.totalScore}/10) from ${topic.data.ranked.length} candidates. Top 3: ${topic.data.ranked
              .slice(0, 3)
              .map((entry) => `${entry.topic} (${entry.totalScore})`)
              .join(", ")}.`,
        durationMs: topic.meta.durationMs,
        status: topic.meta.reused ? "skipped" : "success",
        tokens: topic.meta.tokens,
      }),
    );

    /* ================== STEP 2: Deep research ================== */

    const researchPromptPair = researchPrompt(
      brand.id,
      bestCandidate.topic,
      bestCandidate.angle,
    );

    const research = await tracker.step("research", async () => {
      const checkpointed = readArtifact(checkpoint, "research", researchSchema);

      if (checkpointed) {
        const { facts, counterArguments, statistics, gaps } = checkpointed;
        reused.push("research");

        return {
          value: { data: checkpointed, meta: reusedMeta() },
          status: "skipped" as const,
          message:
            `Kept ${facts.length} facts, ${counterArguments.length} counter-arguments and ${statistics.length} statistics from the earlier attempt — the research pass was not run again.` +
            (gaps.length > 0
              ? ` The ${gaps.length} gap(s) it reported are unchanged and still worth checking.`
              : ""),
          model: null,
          durationMs: 0,
          tokens: 0,
          attempts: 0,
        };
      }

      const result = await runStep({
        step: "research",
        schema: researchSchema,
        contract: "Research output with verified facts",
        prompt: researchPromptPair,
        hint: { brandId: brand.id, step: "research", topic: bestCandidate.topic },
        jobId,
        deadlineAt,
        maxOutputTokens: 4096,
      });

      const { facts, counterArguments, statistics, gaps } = result.value;
      // Fewer than three facts, or named gaps, means the numbers are not
      // corroborated — a caveat on the step, not a failed one.
      const unverified = facts.length < 3 || gaps.length > 0;

      collect(result);
      await saveArtifact("research", result.value);

      return {
        value: { data: result.value, meta: metaFrom(result) },
        status: unverified ? ("warning" as const) : ("success" as const),
        message: unverified
          ? `Found ${facts.length} facts, ${counterArguments.length} counter-arguments, ${statistics.length} statistics — with ${gaps.length} open gap(s) the reviewer should check: ${gaps.slice(0, 2).join(" ")}`
          : `Found ${facts.length} facts, ${counterArguments.length} counter-arguments, ${statistics.length} statistics, all corroborated.`,
        model: `${result.provider.label} · ${result.provider.model}`,
        durationMs: result.latencyMs,
        tokens: result.usage?.totalTokens ?? 0,
        attempts: result.attempts,
      };
    });

    const researchData = research.data;

    logs.push(
      logEntry({
        step: "research",
        provider: research.meta.provider,
        model: research.meta.model,
        message: research.meta.reused
          ? `Reused ${researchData.facts.length} facts and ${researchData.counterArguments.length} counter-arguments from the earlier attempt.`
          : `Found ${researchData.facts.length} facts, ${researchData.counterArguments.length} counter-arguments, ${researchData.statistics.length} statistics.`,
        durationMs: research.meta.durationMs,
        status: research.meta.reused
          ? "skipped"
          : researchData.gaps.length > 0
            ? "warning"
            : "success",
        tokens: research.meta.tokens,
      }),
    );

    // Fact-checking is not a separate call in this pipeline, and pretending
    // otherwise would overstate what ran. What the research pass produced in its
    // place is reported instead.
    await tracker.skip("verify", {
      message:
        researchData.counterArguments.length > 0
          ? `No separate verification call — the research pass returned ${researchData.counterArguments.length} counter-arguments and ${researchData.gaps.length} gap(s), which is what the quality step scores.`
          : "No separate verification call — the research pass is the only source check in this pipeline.",
    });

    /* ================== STEP 3: Carousel writing ================== */

    const contentPrompt = contentWritingPrompt(
      brand.id,
      bestCandidate.topic,
      bestCandidate.angle,
      researchData,
    );

    const content = await tracker.step("carousel", async () => {
      const checkpointed = readArtifact(checkpoint, "carousel", contentSchema);

      if (checkpointed) {
        reused.push("carousel");

        return {
          value: { data: checkpointed, meta: reusedMeta() },
          status: "skipped" as const,
          message: `Kept the ${checkpointed.slides.length}-slide deck from the earlier attempt — the writing pass was not run again.`,
          model: null,
          durationMs: 0,
          tokens: 0,
          attempts: 0,
        };
      }

      const result = await runStep({
        step: "carousel",
        schema: contentSchema,
        contract: "Carousel content with slides",
        prompt: contentPrompt,
        hint: { brandId: brand.id, step: "carousel", topic: bestCandidate.topic },
        jobId,
        deadlineAt,
        maxOutputTokens: 4096,
      });

      collect(result);
      await saveArtifact("carousel", result.value);

      return {
        value: { data: result.value, meta: metaFrom(result) },
        message: `Wrote ${result.value.slides.length} slides. Hook: "${result.value.hook}"`,
        model: `${result.provider.label} · ${result.provider.model}`,
        durationMs: result.latencyMs,
        tokens: result.usage?.totalTokens ?? 0,
        attempts: result.attempts,
      };
    });

    const contentData = content.data;

    logs.push(
      logEntry({
        step: "carousel",
        provider: content.meta.provider,
        model: content.meta.model,
        message: content.meta.reused
          ? `Reused the ${contentData.slides.length}-slide deck from the earlier attempt.`
          : `Created ${contentData.slides.length} slides. Hook: "${contentData.hook}"`,
        durationMs: content.meta.durationMs,
        status: content.meta.reused ? "skipped" : "success",
        tokens: content.meta.tokens,
      }),
    );

    /* ================== STEP 4: Design selection ================== */

    const designPrompt = designSelectionPrompt(brand.id, contentData.slides);

    const design = await tracker.step("design", async () => {
      const checkpointed = readArtifact(checkpoint, "design", designSchema);

      if (checkpointed) {
        reused.push("design");

        return {
          value: { data: checkpointed, meta: reusedMeta() },
          status: "skipped" as const,
          message: `Kept the "${checkpointed.template}" design from the earlier attempt.`,
          model: null,
          durationMs: 0,
          tokens: 0,
          attempts: 0,
        };
      }

      const result = await runStep({
        step: "design",
        schema: designSchema,
        contract: "Design selection",
        prompt: designPrompt,
        hint: { brandId: brand.id, step: "design", topic: bestCandidate.topic },
        jobId,
        deadlineAt,
        maxOutputTokens: 1024,
      });

      collect(result);
      await saveArtifact("design", result.value);

      return {
        value: { data: result.value, meta: metaFrom(result) },
        message: `Chose the "${result.value.template}" template. ${result.value.rationale}`,
        model: `${result.provider.label} · ${result.provider.model}`,
        durationMs: result.latencyMs,
        tokens: result.usage?.totalTokens ?? 0,
        attempts: result.attempts,
      };
    });

    const designData = design.data;

    logs.push(
      logEntry({
        step: "design",
        provider: design.meta.provider,
        model: design.meta.model,
        message: design.meta.reused
          ? `Reused the "${designData.template}" design from the earlier attempt.`
          : `Selected "${designData.template}" design. ${designData.rationale}`,
        durationMs: design.meta.durationMs,
        status: design.meta.reused ? "skipped" : "success",
        tokens: design.meta.tokens,
      }),
    );

    /* ================== STEP 5: Quality review ================== */

    const qualityPromptPair = qualityScoringPrompt(brand.id, contentData);

    const quality = await tracker.step("quality", async () => {
      const checkpointed = readArtifact(checkpoint, "quality", qualityReviewSchema);

      if (checkpointed) {
        reused.push("quality");

        return {
          value: { data: checkpointed, meta: reusedMeta() },
          status: "skipped" as const,
          message: `Kept the earlier review — scored ${checkpointed.averageScore}/10 (${checkpointed.verdict}).`,
          model: null,
          durationMs: 0,
          tokens: 0,
          attempts: 0,
        };
      }

      const result = await runStep({
        step: "quality",
        schema: qualityReviewSchema,
        contract: "Quality review scores",
        prompt: qualityPromptPair,
        hint: { brandId: brand.id, step: "quality", topic: bestCandidate.topic },
        jobId,
        deadlineAt,
        maxOutputTokens: 1024,
      });

      const review = result.value;
      collect(result);
      await saveArtifact("quality", review);

      return {
        value: { data: review, meta: metaFrom(result) },
        status: review.verdict === "approve" ? ("success" as const) : ("warning" as const),
        message: `Scored ${review.averageScore}/10 (${review.verdict}). ${review.improvements.length} improvement(s) suggested${
          review.blockers.length > 0
            ? `, ${review.blockers.length} blocker(s): ${review.blockers.slice(0, 2).join("; ")}`
            : ""
        }.`,
        model: `${result.provider.label} · ${result.provider.model}`,
        durationMs: result.latencyMs,
        tokens: result.usage?.totalTokens ?? 0,
        attempts: result.attempts,
      };
    });

    const qualityReview = quality.data;
    const averageScore = qualityReview.averageScore;

    logs.push(
      logEntry({
        step: "quality",
        provider: quality.meta.provider,
        model: quality.meta.model,
        message: quality.meta.reused
          ? `Review reused from the earlier attempt: ${averageScore}/10 (${qualityReview.verdict}).`
          : `Score: ${averageScore}/10 (${qualityReview.verdict}). ${qualityReview.improvements.length} improvements suggested.`,
        durationMs: quality.meta.durationMs,
        status: quality.meta.reused
          ? "skipped"
          : qualityReview.verdict === "approve"
            ? "success"
            : "warning",
        tokens: quality.meta.tokens,
      }),
    );

    /* ================== STEP 6: Final polish ================== */

    const hashtagPromptPair = hashtagPrompt(
      brand.id,
      contentData.title,
      bestCandidate.topic,
    );

    const hashtags = await tracker.step("hashtags", async () => {
      const checkpointed = readArtifact(checkpoint, "hashtags", hashtagSchema);

      if (checkpointed) {
        reused.push("hashtags");

        return {
          value: { data: checkpointed, meta: reusedMeta() },
          status: "skipped" as const,
          message: `Kept ${checkpointed.hashtags.length} hashtags from the earlier attempt.`,
          model: null,
          durationMs: 0,
          tokens: 0,
          attempts: 0,
        };
      }

      const result = await runStep({
        step: "hashtags",
        schema: hashtagSchema,
        contract: "Hashtag list",
        prompt: hashtagPromptPair,
        hint: { brandId: brand.id, step: "hashtags", topic: bestCandidate.topic },
        jobId,
        deadlineAt,
        maxOutputTokens: 512,
      });

      collect(result);
      await saveArtifact("hashtags", result.value);

      return {
        value: { data: result.value, meta: metaFrom(result) },
        message: `Produced ${result.value.hashtags.length} topic hashtags, merged with the brand's base set.`,
        model: `${result.provider.label} · ${result.provider.model}`,
        durationMs: result.latencyMs,
        tokens: result.usage?.totalTokens ?? 0,
        attempts: result.attempts,
      };
    });

    const captionPromptPair = captionWritingPrompt(
      brand.id,
      contentData.title,
      contentData.hook,
      contentData.keyTakeaway,
    );

    const caption = await tracker.step("caption", async () => {
      const checkpointed = readArtifact(checkpoint, "caption", captionSchema);

      if (checkpointed) {
        reused.push("caption");

        return {
          value: { data: checkpointed, meta: reusedMeta() },
          status: "skipped" as const,
          message: `Kept the ${checkpointed.caption.length}-character caption from the earlier attempt.`,
          model: null,
          durationMs: 0,
          tokens: 0,
          attempts: 0,
        };
      }

      const result = await runStep({
        step: "caption",
        schema: captionSchema,
        contract: "Caption text",
        prompt: captionPromptPair,
        hint: { brandId: brand.id, step: "caption", topic: bestCandidate.topic },
        jobId,
        deadlineAt,
        maxOutputTokens: 1024,
      });

      collect(result);
      await saveArtifact("caption", result.value);

      return {
        value: { data: result.value, meta: metaFrom(result) },
        message: `Wrote a ${result.value.caption.length}-character caption.`,
        model: `${result.provider.label} · ${result.provider.model}`,
        durationMs: result.latencyMs,
        tokens: result.usage?.totalTokens ?? 0,
        attempts: result.attempts,
      };
    });

    logs.push(
      logEntry({
        step: "hashtags",
        provider: hashtags.meta.provider,
        model: hashtags.meta.model,
        message: hashtags.meta.reused
          ? `Reused ${hashtags.data.hashtags.length} hashtags from the earlier attempt.`
          : `Generated ${hashtags.data.hashtags.length} topic hashtags.`,
        durationMs: hashtags.meta.durationMs,
        status: hashtags.meta.reused ? "skipped" : "success",
        tokens: hashtags.meta.tokens,
      }),
      logEntry({
        step: "caption",
        provider: caption.meta.provider,
        model: caption.meta.model,
        message: caption.meta.reused
          ? `Caption reused from the earlier attempt (${caption.data.caption.length} characters).`
          : `Caption written (${caption.data.caption.length} characters).`,
        durationMs: caption.meta.durationMs,
        status: caption.meta.reused ? "skipped" : "success",
        tokens: caption.meta.tokens,
      }),
    );

    /* ================== Build the post ================== */

    const slides: Slide[] = contentData.slides.map((s, i) => ({
      id: `slide-${i + 1}`,
      index: i,
      kind: s.kind as Slide["kind"],
      kicker: s.kicker,
      headline: s.headline,
      body: s.body,
      footnote: s.footnote ?? undefined,
    }));

    const altText = contentData.slides.map((s) => s.headline).join(". ");

    // Alt text is derived, not generated, and saying which is the difference
    // between a run report a reviewer can trust and one they have to interpret.
    await tracker.step("alt_text", async () => ({
      value: altText,
      message: `Derived from the ${slides.length} slide headlines — no separate model call.`,
      model: null,
      durationMs: 0,
      tokens: 0,
    }));

    logs.push(
      logEntry({
        step: "alt_text",
        provider: "derived",
        model: "slide headlines",
        message: `Alt text assembled from ${slides.length} slide headlines.`,
        durationMs: 0,
        status: "success",
        tokens: 0,
      }),
    );

    const qualityReport: QualityReport = {
      score: Math.round(averageScore * 10),
      verdict:
        averageScore >= 8
          ? "excellent"
          : averageScore >= 7
            ? "strong"
            : averageScore >= 6
              ? "review"
              : "weak",
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

    const finalHashtags = [
      ...new Set([...brand.hashtagBase, ...hashtags.data.hashtags]),
    ].slice(0, 12);

    const draft: Post = {
      id: "",
      title: contentData.title,
      caption: caption.data.caption,
      brandId: brand.id,
      templateId: `tpl-${designData.template}`,
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
      altText,
      sources: toSources(researchData.facts),
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
            title: contentData.title,
            caption: caption.data.caption,
            hashtags: finalHashtags,
            altText,
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

    await tracker.succeed({ postId: post.id, tokens });

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
  } catch (error) {
    // A step that throws has already closed the run out with its own message.
    // This catches errors raised *between* steps — and guarantees that whatever
    // goes wrong, the run is not left claiming to still be running.
    await tracker.fail(error);
    throw error;
  }
}

/* ==================== Zod Schemas ==================== */

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
  statistics: z.array(
    z.object({
      value: z.string(),
      context: z.string(),
      source: z.string(),
      year: z.number(),
    }),
  ),
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
  colorOverrides: z
    .object({
      background: z.string(),
      foreground: z.string(),
      accent: z.string(),
    })
    .optional(),
  typographyNotes: z.string().optional(),
  slideDesigns: z
    .array(
      z.object({
        slideIndex: z.number(),
        layout: z.string(),
        visualNotes: z.string(),
      }),
    )
    .optional(),
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
