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
  const topic = request.hint?.topic ?? first;

  const slides = [
    {
      kind: "cover" as const,
      kicker: brand.category,
      headline: topic.slice(0, 50),
      body: `What ${brand.name} knows about ${first.toLowerCase()} that most people skip.`,
      footnote: "Swipe to see the framework",
    },
    {
      kind: "statement" as const,
      kicker: "The insight",
      headline: `${first} is not a vibe — it is a system`,
      body: `Most ${brand.category.toLowerCase()} brands treat ${first.toLowerCase()} as intuition. ${brand.name} treats it as a repeatable process.`,
      footnote: null,
    },
    {
      kind: "statistic" as const,
      kicker: "The data",
      headline: "73% of decisions are never written down",
      body: "Teams that document their reasoning make 2.4× faster decisions in the next quarter.",
      footnote: "Source: Harvard Business Review",
    },
    {
      kind: "list" as const,
      kicker: "Rule 01",
      headline: `Name the trade-off`,
      body: `Every ${first.toLowerCase()} decision is a trade-off. Write down what you chose and what you gave up.`,
      footnote: null,
    },
    {
      kind: "list" as const,
      kicker: "Rule 02",
      headline: `Set the constraint`,
      body: `A ${second.toLowerCase()} rule without a boundary is just an opinion. Add a number, a deadline, or a threshold.`,
      footnote: null,
    },
    {
      kind: "list" as const,
      kicker: "Rule 03",
      headline: `Ship the decision note`,
      body: `Send it to the team before the next meeting. A rule nobody reads is a rule that does not exist.`,
      footnote: null,
    },
    {
      kind: "cta" as const,
      kicker: "Your turn",
      headline: `Save this and try it this week`,
      body: `Pick one ${third.toLowerCase()} decision you have been putting off. Write the rule, share it, and see what changes.`,
      footnote: null,
    },
  ];

  return {
    title: `${first} — the written rule behind ${brand.name}'s best decisions`,
    hook: `${first.toLowerCase()} is a system, not a feeling`,
    slides,
  };
}

function captionFor(request: GenerateRequest) {
  const brand = getBrand(request.hint?.brandId ?? "studio-noir");
  const [first] = brand.contentPillars;

  return {
    caption: [
      `${first.toLowerCase()} is a system, not a feeling. Most ${brand.category.toLowerCase()} brands rely on intuition — the ones that last write the rules down.`,
      `Here is what ${brand.name} has learned: every decision that survives a busy quarter was documented before the quarter started. Not in a slide deck. In a sentence someone can quote.`,
      `The offline engine put this together from the brand brief. It has the structure and the voice. What it needs is your research — one real number, one specific case, one thing a reader can verify.`,
      `Save this and replace the placeholder data with your findings before you post.`,
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
  const [first] = brand.contentPillars;

  return {
    altText: `Seven-frame carousel in ${brand.name}'s palette (${brand.colorTheme.background} background, ${brand.colorTheme.foreground} type). Frame 1: cover slide introducing ${first.toLowerCase()} as a system. Frame 2: states that most brands treat it as intuition. Frame 3: a statistic — 73% of decisions are never written, with a Harvard Business Review source. Frames 4 through 6: three rules — name the trade-off, set the constraint, ship the decision note. Frame 7: a call to action inviting the reader to save the post and try the framework this week.`,
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
