import { getBrand } from "@/data/brands";
import type { AiStepId } from "@/types";

import { AI_ENV, type AiProvider, type GenerateRequest, type GenerateResult } from "./types";

/**
 * The offline engine — opt-in via `AI_ENABLE_LOCAL_PROVIDER=true`.
 *
 * It exists so the pipeline is testable end to end and so the app still works
 * without keys. It is deliberately *not* a pretend model: it composes
 * structurally valid drafts from the brand brief, runs no research, and its
 * quality step caps every score low and lists the missing research as a blocker.
 * Drafts it produces are labelled in the AI log and arrive in the queue with a
 * review note, so nobody can mistake one for a researched post.
 */

const OFFLINE_QUALITY_CAP = 62;

const BLOCKERS = [
  "Produced by the offline engine: no research or fact-checking was run.",
  "Rewrite with Gemini, Groq or OpenRouter before this is approved.",
];

function topicFor(request: GenerateRequest) {
  const brand = getBrand(request.hint?.brandId ?? "studio-noir");
  const pillar = brand.contentPillars[0];
  const second = brand.contentPillars[1] ?? pillar;

  return {
    topic: `${pillar} — the part of ${brand.positioning.toLowerCase()} that is measurable`,
    angle: `Take one ${pillar.toLowerCase()} decision and show what changed after it, using ${second.toLowerCase()} as the frame.`,
    pillar,
    rationale: `Offline engine: selected the brand's primary pillar (${pillar}) because no research provider is configured.`,
  };
}

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

function carouselFor(request: GenerateRequest) {
  const brand = getBrand(request.hint?.brandId ?? "studio-noir");
  const [first, second = first, third = first] = brand.contentPillars;

  const slides = [
    {
      kind: "cover" as const,
      kicker: brand.category,
      headline: `Write the rule down`,
      body: `What ${brand.name} believes about ${first.toLowerCase()}`,
      footnote: "Swipe for the reasoning",
    },
    {
      kind: "statement" as const,
      kicker: "The premise",
      headline: `${first}`,
      body: `The decisions that survive are the ones with a written rule behind them.`,
      footnote: null,
    },
    {
      kind: "statistic" as const,
      kicker: "The gap",
      headline: "No number yet",
      body: "The offline engine did not research this post, so no figure belongs here.",
      footnote: null,
    },
    {
      kind: "list" as const,
      kicker: "Rule 01",
      headline: `${second}`,
      body: `Decide it once, in writing, so the next person does not relitigate it.`,
      footnote: null,
    },
    {
      kind: "list" as const,
      kicker: "Rule 02",
      headline: `${third}`,
      body: "Keep the rule short enough to quote from memory.",
      footnote: null,
    },
    {
      kind: "cta" as const,
      kicker: "Next",
      headline: "Save this for your next review",
      body: `Then replace the placeholder number with a real one from ${brand.name}'s research pass.`,
      footnote: null,
    },
  ];

  return {
    title: `${first} — the written rule`,
    hook: "Write the rule down",
    slides,
  };
}

function captionFor(request: GenerateRequest) {
  const brand = getBrand(request.hint?.brandId ?? "studio-noir");

  return {
    caption: [
      `Write the rule down. That is the whole difference between a ${brand.name} decision that survives a busy quarter and one that quietly disappears.`,
      `A rule is not a preference: it names the situation, the choice and the reason. Once it is written, the argument about ${brand.contentPillars[0].toLowerCase()} ends and the work continues.`,
      `This draft came from the offline engine, so it has no research and no numbers yet. Use it as a skeleton: replace the placeholder frame with the finding your research pass turns up.`,
      `Save it, and add the rule before you post.`,
    ].join("\n\n"),
  };
}

function hashtagsFor(request: GenerateRequest) {
  const brand = getBrand(request.hint?.brandId ?? "studio-noir");

  return {
    hashtags: [
      ...brand.hashtagBase,
      `#${brand.category.toLowerCase()}`,
      "#contentstrategy",
      "#editorialcalm",
    ].slice(0, 8),
  };
}

function altTextFor(request: GenerateRequest) {
  const brand = getBrand(request.hint?.brandId ?? "studio-noir");

  return {
    altText: `Six frames in ${brand.name}'s palette (${brand.colorTheme.background} background, ${brand.colorTheme.foreground} type). Frame 1 sets the theme: write the rule down. Frame 2 states the premise that written rules outlive preferences. Frame 3 holds a placeholder where a researched figure belongs. Frames 4 and 5 give two short rules in large type. Frame 6 invites the reader to save the post for their next review.`,
  };
}

function qualityFor() {
  return {
    score: OFFLINE_QUALITY_CAP,
    summary:
      "Structurally complete, but nothing here has been researched or verified. It is a skeleton to edit, not a post to approve.",
    criteria: [
      {
        id: "hook",
        label: "Hook strength",
        weight: 0.25,
        score: 58,
        note: "Clear but generic until the real finding replaces the placeholder.",
      },
      {
        id: "clarity",
        label: "Caption clarity",
        weight: 0.25,
        score: 66,
        note: "Reads cleanly; the middle section needs the actual evidence.",
      },
      {
        id: "visual",
        label: "Visual consistency",
        weight: 0.2,
        score: 64,
        note: "Statement and rule structure alternates properly across six frames.",
      },
      {
        id: "hashtags",
        label: "Hashtag coverage",
        weight: 0.15,
        score: 61,
        note: "Brand and category tags only — niche tags need the researched topic.",
      },
      {
        id: "alt",
        label: "Alt text quality",
        weight: 0.15,
        score: 70,
        note: "Covers every frame and states the palette and layout.",
      },
    ],
    blockers: BLOCKERS,
  };
}

function payloadFor(request: GenerateRequest) {
  const carousel = carouselFor(request);

  return {
    ...carousel,
    ...captionFor(request),
    ...hashtagsFor(request),
    ...altTextFor(request),
    references: [],
    qualityScore: qualityFor(),
  };
}

const STEP_BUILDERS: Record<AiStepId, (request: GenerateRequest) => unknown> = {
  topic: topicFor,
  research: researchFor,
  verify: verifyFor,
  carousel: carouselFor,
  caption: captionFor,
  hashtags: hashtagsFor,
  alt_text: altTextFor,
  quality: qualityFor,
};

export const localProvider: AiProvider = {
  id: "local",
  label: "Offline engine",
  model: AI_ENV.local.model,
  configured: AI_ENV.local.enabled,
  priority: 3,
  roles: ["fallback"],
  envKeys: AI_ENV.local.keys,
  supportsGrounding: false,
  note: "Deterministic offline drafts. Enable with AI_ENABLE_LOCAL_PROVIDER=true.",

  async generate(request: GenerateRequest): Promise<GenerateResult> {
    const step = request.hint?.step ?? "topic";
    const build = STEP_BUILDERS[step];
    const value =
      step === "quality" && !request.hint?.granular ? payloadFor(request) : build(request);

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
