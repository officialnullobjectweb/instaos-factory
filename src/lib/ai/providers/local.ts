import { getBrand } from "@/data/brands";
import type { AiStepId } from "@/types";

import { AI_ENV, type AiProvider, type GenerateRequest, type GenerateResult } from "./types";
import {
  planContent,
  generateHook,
  generateArc,
  generateCaption,
  generateHashtags,
  generateAltText,
  type SlideContent,
} from "../content-writer";
import {
  selectDesign,
  designSlides,
  enforceContentDesignLimits,
  scoreDesignQuality,
  type LayoutStyle,
} from "../design-engine";

/**
 * The offline engine — opt-in via `AI_ENABLE_LOCAL_PROVIDER=true`.
 *
 * Now powered by a psychology-based content writer and design engine.
 * Every post follows:
 * 1. Topic selection (dedup-aware, filtered against existing titles)
 * 2. Content planning (emotional arc, hook type, tone)
 * 3. Hook generation (curiosity gap, social proof, loss aversion, etc.)
 * 4. Arc generation (problem→solution, myth→reality, data→insight, etc.)
 * 5. Design selection (layout, typography, color, spacing)
 * 6. Content-design coordination (limits, pacing, variety)
 * 7. Quality scoring (evaluates the coordination)
 *
 * Still labelled as offline — no research or fact-checking.
 */

const OFFLINE_QUALITY_CAP = 62;

const BLOCKERS = [
  "Produced by the offline engine: no research or fact-checking was run.",
  "Rewrite with Gemini, Groq or OpenRouter before this is approved.",
];

/* -------------------------------------------------------------------------- */
/*  Topic step — dedup-aware topic selection                                  */
/* -------------------------------------------------------------------------- */

function topicFor(request: GenerateRequest) {
  const brand = getBrand(request.hint?.brandId ?? "studio-noir");
  const pillars = brand.contentPillars;
  const pillar = pillars[0];
  const second = pillars[1] ?? pillar;
  const third = pillars[2] ?? second;
  const avoid: string[] = request.hint?.avoid ?? [];
  const avoidLower = avoid.map((a) => a.toLowerCase());

  const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

  // Large pool of varied topics — each maps to a different content plan.
  const allTopics: Array<{ topic: string; angle: string; pillar: string }> = [
    // Curiosity gap topics
    {
      topic: `${pillar} — the metric nobody tracks`,
      angle: `What ${brand.name} learned after 100 ${pillar.toLowerCase()} decisions.`,
      pillar,
    },
    {
      topic: `${second} — the hidden cost of ignoring it`,
      angle: `The cost of waiting for perfect information in ${second.toLowerCase()}.`,
      pillar: second,
    },
    // Social proof topics
    {
      topic: `${pillar} — what the top 10% do differently`,
      angle: `Teams that write down their ${pillar.toLowerCase()} rules move 2.4× faster.`,
      pillar,
    },
    {
      topic: `${second} — the data behind great decisions`,
      angle: `After studying 50 ${brand.category.toLowerCase()} teams, this pattern emerged.`,
      pillar: second,
    },
    // Loss aversion topics
    {
      topic: `${pillar} — where your time is leaking`,
      angle: `Every unwritten rule costs you ${brand.category.toLowerCase()} momentum.`,
      pillar,
    },
    {
      topic: `${second} — stop losing knowledge when people leave`,
      angle: `This is what happens when you skip the ${second.toLowerCase()} framework.`,
      pillar: second,
    },
    // Authority topics
    {
      topic: `${pillar} — the framework behind the best work`,
      angle: `How ${brand.name} approaches ${pillar.toLowerCase()} — and why it works.`,
      pillar,
    },
    {
      topic: `${second} — a playbook from the front lines`,
      angle: `${brand.name} on ${second.toLowerCase()}: what we know after years of practice.`,
      pillar: second,
    },
    // Specificity topics
    {
      topic: `${pillar} — three rules that survive busy quarters`,
      angle: `The exact ${pillar.toLowerCase()} process ${brand.name} uses daily.`,
      pillar,
    },
    {
      topic: `${second} — the two numbers that matter`,
      angle: `Two numbers that tell you if your ${second.toLowerCase()} is working.`,
      pillar: second,
    },
    // Contrast topics
    {
      topic: `${pillar} — gut instinct vs. written rules`,
      angle: `Gut instinct vs. written rules: which one survives Q4?`,
      pillar,
    },
    {
      topic: `${second} — reactive vs. proactive`,
      angle: `Reactive vs. proactive ${second.toLowerCase()}: the data speaks.`,
      pillar: second,
    },
    // Narrative topics
    {
      topic: `${pillar} — the moment everything changed`,
      angle: `The story behind ${brand.name}'s ${pillar.toLowerCase()} framework.`,
      pillar,
    },
    {
      topic: `${second} — from chaos to clarity`,
      angle: `How ${brand.name} built its ${second.toLowerCase()} system.`,
      pillar: second,
    },
    // Identity topics
    {
      topic: `${pillar} — for the team that is tired of reinventing`,
      angle: `This is for the ${brand.category.toLowerCase()} team that wants to stop repeating.`,
      pillar,
    },
    {
      topic: `${second} — built for leaders who document`,
      angle: `The ${brand.category.toLowerCase()} leaders who document their thinking.`,
      pillar: second,
    },
    // Extra variety
    {
      topic: `${third} — the simplest system that works`,
      angle: `The simplest ${third.toLowerCase()} system that actually works — no fluff.`,
      pillar: third,
    },
    {
      topic: `${third} — what happens after the first rule`,
      angle: `What happens after you write the first ${third.toLowerCase()} rule.`,
      pillar: third,
    },
  ];

  // Filter out titles that already exist — substring match catches near-duplicates.
  const available = allTopics.filter((t) => {
    const topicLower = t.topic.toLowerCase();
    return !avoidLower.some(
      (a) => a.includes(topicLower) || topicLower.includes(a),
    );
  });

  // If we exhausted the pool, log a warning but still pick.
  if (available.length === 0) {
    console.warn(
      `[offline] Topic pool exhausted for brand ${brand.id} — ${avoid.length} titles already used. Picking from full pool as fallback.`,
    );
  }

  const picked = available.length > 0 ? pick(available) : pick(allTopics);

  return {
    topic: picked.topic,
    angle: picked.angle,
    pillar: picked.pillar,
    rationale: `Offline engine: picked from ${available.length}/${allTopics.length} available topics, filtered against ${avoid.length} existing titles. Psychology-driven content plan applied.`,
  };
}

/* -------------------------------------------------------------------------- */
/*  Research step — placeholder facts                                        */
/* -------------------------------------------------------------------------- */

function researchFor(request: GenerateRequest) {
  const brand = getBrand(request.hint?.brandId ?? "studio-noir");

  return {
    facts: brand.contentPillars.slice(0, 3).map((pillar) => ({
      claim: `${pillar} decisions are only useful when someone has written down the rule behind them.`,
      evidence:
        "Offline engine: no sources were consulted, so this is a prompt for research rather than a finding.",
      sourceTitle: "Not researched",
      sourceUrl: "",
      publisher: "Offline engine",
      confidence: "low" as const,
    })),
    gaps: [
      "Every claim needs a real source before publishing.",
      "No numbers were gathered — add at least one quantitative fact.",
    ],
  };
}

/* -------------------------------------------------------------------------- */
/*  Verify step — placeholder verification                                   */
/* -------------------------------------------------------------------------- */

function verifyFor() {
  return {
    claims: [
      {
        claim: "All claims in this draft",
        verdict: "unsupported" as const,
        rationale:
          "Offline engine: nothing was fact-checked because no research provider was available.",
      },
    ],
    rejected: ["All claims in this draft"],
  };
}

/* -------------------------------------------------------------------------- */
/*  Carousel step — psychology-based content with design coordination         */
/* -------------------------------------------------------------------------- */

function carouselFor(request: GenerateRequest) {
  const brand = getBrand(request.hint?.brandId ?? "studio-noir");
  const [first, second = first, third = first] = brand.contentPillars;
  const topic = request.hint?.topic ?? first;

  // 1. Plan the content strategy.
  const plan = planContent(brand, topic, first);

  // 2. Generate the hook using psychology.
  const hook = generateHook(plan.hook, {
    brand,
    topic,
    pillar: first,
    angle: request.hint?.topic ?? first,
  });

  // 3. Generate the slide set following the emotional arc.
  const rawSlides = generateArc(plan.emotionalArc, {
    brand,
    topic,
    pillar: first,
    hook,
    secondPillar: second,
    thirdPillar: third,
  });

  // 4. Select the design approach.
  const designSpec = selectDesign(plan, brand);

  // 5. Apply design to slides.
  const designedSlides = designSlides(rawSlides, designSpec, brand);

  // 6. Enforce content-design limits.
  const finalSlides = enforceContentDesignLimits(designedSlides);

  // 7. Convert to the schema format (strip design metadata).
  const slides: SlideContent[] = finalSlides.map((s) => ({
    kind: s.kind,
    kicker: s.kicker,
    headline: s.headline,
    body: s.body,
    footnote: s.footnote,
  }));

  return {
    title: topic,
    hook,
    slides,
  };
}

/* -------------------------------------------------------------------------- */
/*  Caption step — psychology-based caption                                   */
/* -------------------------------------------------------------------------- */

function captionFor(request: GenerateRequest) {
  const brand = getBrand(request.hint?.brandId ?? "studio-noir");
  const [first] = brand.contentPillars;
  const topic = request.hint?.topic ?? first;

  // Plan content to get the tone.
  const plan = planContent(brand, topic, first);

  const caption = generateCaption({
    brand,
    topic,
    pillar: first,
    hook: topic,
    tone: plan.tone,
  });

  return { caption };
}

/* -------------------------------------------------------------------------- */
/*  Hashtags step — context-aware hashtags                                    */
/* -------------------------------------------------------------------------- */

function hashtagsFor(request: GenerateRequest) {
  const brand = getBrand(request.hint?.brandId ?? "studio-noir");
  const [first] = brand.contentPillars;
  const topic = request.hint?.topic ?? first;

  return {
    hashtags: generateHashtags(brand, topic, first),
  };
}

/* -------------------------------------------------------------------------- */
/*  Alt text step — describes the carousel visually                           */
/* -------------------------------------------------------------------------- */

function altTextFor(request: GenerateRequest) {
  const brand = getBrand(request.hint?.brandId ?? "studio-noir");
  const [first] = brand.contentPillars;
  const topic = request.hint?.topic ?? first;

  // Generate a sample slide set for alt text description.
  const plan = planContent(brand, topic, first);
  const rawSlides = generateArc(plan.emotionalArc, {
    brand,
    topic,
    pillar: first,
    hook: topic,
    secondPillar: brand.contentPillars[1] ?? first,
    thirdPillar: brand.contentPillars[2] ?? first,
  });

  return {
    altText: generateAltText(brand, rawSlides, topic),
  };
}

/* -------------------------------------------------------------------------- */
/*  Quality step — evaluates content-design coordination                      */
/* -------------------------------------------------------------------------- */

function qualityFor(request: GenerateRequest) {
  const brand = getBrand(request.hint?.brandId ?? "studio-noir");
  const [first] = brand.contentPillars;
  const topic = request.hint?.topic ?? first;

  // Generate the same content to score it.
  const plan = planContent(brand, topic, first);
  const rawSlides = generateArc(plan.emotionalArc, {
    brand,
    topic,
    pillar: first,
    hook: topic,
    secondPillar: brand.contentPillars[1] ?? first,
    thirdPillar: brand.contentPillars[2] ?? first,
  });
  const designSpec = selectDesign(plan, brand);
  const designedSlides = designSlides(rawSlides, designSpec, brand);
  const finalSlides = enforceContentDesignLimits(designedSlides);

  const designQuality = scoreDesignQuality(finalSlides, plan);

  // Combine design quality with offline limitations.
  const offlineScore = Math.min(OFFLINE_QUALITY_CAP, designQuality.score);

  return {
    score: offlineScore,
    summary: `Psychology-driven ${plan.emotionalArc} arc with ${plan.hook} hook. Design: ${designSpec.layout} layout, ${plan.tone} tone. ${BLOCKERS[0]}`,
    criteria: [
      ...designQuality.criteria.map((c) => ({
        ...c,
        score: Math.min(c.score, OFFLINE_QUALITY_CAP),
      })),
      {
        id: "research",
        label: "Research depth",
        weight: 0.15,
        score: 0,
        note: "No research conducted — offline engine only.",
      },
    ],
    blockers: BLOCKERS,
  };
}

/* -------------------------------------------------------------------------- */
/*  Design step — picks the visual direction for the written content          */
/* -------------------------------------------------------------------------- */

/**
 * The design engine and the carousel templates name their layouts differently —
 * it reasons in terms of reader state ("data-driven", "grid"), while the template
 * library ships concrete designs. This is the one place that translation lives.
 */
const TEMPLATE_FOR_LAYOUT: Record<LayoutStyle, string> = {
  editorial: "editorial",
  "data-driven": "data-viz",
  grid: "data-viz",
  narrative: "illustrated",
  minimalist: "minimal",
  bold: "bold",
};

function designFor(request: GenerateRequest) {
  const brand = getBrand(request.hint?.brandId ?? "studio-noir");
  const [first] = brand.contentPillars;
  const topic = request.hint?.topic ?? first;

  const plan = planContent(brand, topic, first);
  const spec = selectDesign(plan, brand);

  return {
    template: TEMPLATE_FOR_LAYOUT[spec.layout],
    rationale: `Offline engine: a ${plan.emotionalArc} arc at a ${plan.tone} tone reads best as the ${spec.layout} layout — ${spec.spacing} spacing, ${spec.emphasis} emphasis, weighted ${spec.visualWeight}.`,
    typographyNotes: `Typography: ${spec.typography.join(", ")}. Colour role: ${spec.colorRole}.`,
  };
}

/* -------------------------------------------------------------------------- */
/*  Composed payload — non-granular mode                                      */
/* -------------------------------------------------------------------------- */

function payloadFor(request: GenerateRequest) {
  const carousel = carouselFor(request);
  const brand = getBrand(request.hint?.brandId ?? "studio-noir");
  const [first] = brand.contentPillars;
  const topic = request.hint?.topic ?? first;
  const plan = planContent(brand, topic, first);

  return {
    ...carousel,
    ...captionFor(request),
    ...hashtagsFor(request),
    ...altTextFor(request),
    references: [],
    qualityScore: qualityFor(request),
  };
}

/* -------------------------------------------------------------------------- */
/*  Step dispatch                                                             */
/* -------------------------------------------------------------------------- */

const STEP_BUILDERS: Record<AiStepId, (request: GenerateRequest) => unknown> = {
  topic: topicFor,
  research: researchFor,
  verify: verifyFor,
  carousel: carouselFor,
  design: designFor,
  caption: captionFor,
  hashtags: hashtagsFor,
  alt_text: altTextFor,
  quality: qualityFor,
};

/* -------------------------------------------------------------------------- */
/*  Provider export                                                           */
/* -------------------------------------------------------------------------- */

export const localProvider: AiProvider = {
  id: "local",
  label: "Offline engine",
  model: AI_ENV.local.model,
  configured: AI_ENV.local.enabled,
  priority: 3,
  roles: ["fallback"],
  envKeys: AI_ENV.local.keys,
  supportsGrounding: false,
  note: "Psychology-driven offline drafts. Enable with AI_ENABLE_LOCAL_PROVIDER=true.",

  async generate(request: GenerateRequest): Promise<GenerateResult> {
    const step = request.hint?.step ?? "topic";
    const build = STEP_BUILDERS[step];
    const granular = request.hint?.granular ?? true;
    // In non-granular mode the compose step sends generationPayloadSchema
    // which requires caption, hashtags, altText and qualityScore. The local
    // provider must return the full payload so validation passes.
    const value =
      !granular && (step === "carousel" || step === "quality")
        ? payloadFor(request)
        : build(request);

    // A tiny delay keeps the UI's step timeline honest instead of flashing.
    await new Promise((resolve) => setTimeout(resolve, 120));

    return {
      text: JSON.stringify(value, null, 2),
      model: AI_ENV.local.model,
      grounded: false,
      sources: [],
      usage: { inputTokens: null, outputTokens: null, totalTokens: null },
    };
  },
};

export { payloadFor as offlinePayload };
