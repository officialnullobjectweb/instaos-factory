import { getBrand } from "@/data/brands";
import type { TopicGuidance } from "@/lib/insights/weighting";
import type {
  ResearchOutput,
  TopicOutput,
  VerifyOutput,
} from "@/lib/ai/schema";
import type { AiStepId, Brand, BrandId, PostCategory } from "@/types";

/**
 * The prompt library.
 *
 * Every model call in the generation engine comes from here — there are no
 * inline prompts anywhere else. Brand voice, style, reading level, palette and
 * pillars are read from `data/brands.ts`, so changing a brand's brief changes
 * every prompt with it.
 *
 * The JSON snippets below are the human-facing contract. `lib/ai/schema.ts`
 * holds the authoritative Zod validators that actually decide what is usable;
 * the two are deliberately written to match, and the repair step re-states the
 * same contract when a model misses it.
 */

export interface PromptPair {
  system: string;
  user: string;
}

/* -------------------------------------------------------------------------- */
/*  Shared building blocks                                                    */
/* -------------------------------------------------------------------------- */

/** Applies to every call: house rules that keep output machine-checkable. */
const OUTPUT_RULES = [
  "Reply with a single JSON object and nothing else.",
  "No markdown, no code fences, no commentary before or after the JSON.",
  "Use double quotes for every key and string. Never use trailing commas.",
  "If you are unsure about a fact, lower its confidence instead of inventing a source.",
].join("\n- ");

/** Per-step JSON contracts, reused by the validation-repair prompt. */
export const STEP_CONTRACTS: Record<AiStepId, string> = {
  topic: `{
  "topic": string,
  "angle": string,
  "pillar": string,
  "rationale": string
}`,
  research: `{
  "facts": [
    { "claim": string, "evidence": string, "sourceTitle": string, "sourceUrl": string, "publisher": string, "confidence": "high" | "medium" | "low" }
  ],
  "gaps": string[]
}`,
  verify: `{
  "claims": [ { "claim": string, "verdict": "supported" | "unsupported" | "uncertain", "rationale": string } ],
  "rejected": string[]
}`,
  carousel: `{
  "title": string,
  "hook": string,
  "slides": [
    { "kind": "cover" | "statement" | "list" | "statistic" | "quote" | "cta", "kicker": string, "headline": string, "body": string, "footnote": string | null }
  ]
}`,
  design: `{
  "template": "editorial" | "data-viz" | "minimal" | "bold" | "illustrated",
  "rationale": string
}`,
  caption: `{ "caption": string }`,
  hashtags: `{ "hashtags": string[] }`,
  alt_text: `{ "altText": string }`,
  quality: `{
  "score": number,
  "summary": string,
  "criteria": [ { "id": string, "label": string, "weight": number, "score": number, "note": string } ],
  "blockers": string[]
}`,
};

const COMPOSED_CONTRACT = `{
  "title": string,
  "hook": string,
  "slides": [
    { "kind": "cover" | "statement" | "list" | "statistic" | "quote" | "cta", "kicker": string, "headline": string, "body": string, "footnote": string | null }
  ],
  "caption": string,
  "hashtags": string[],
  "altText": string,
  "references": [ { "title": string, "publisher": string, "url": string, "credibility": "high" | "medium" | "low" } ],
  "qualityScore": {
    "score": number,
    "summary": string,
    "criteria": [ { "id": string, "label": string, "weight": number, "score": number, "note": string } ],
    "blockers": string[]
  }
}`;

/** The five criteria the quality step must score, shared by every quality prompt. */
export const QUALITY_CRITERIA_BRIEF = [
  "hook (weight 0.25) — does slide 1 stop the scroll without clickbait",
  "clarity (weight 0.25) — is the caption readable at the brand's reading level",
  "visual (weight 0.2) — do the slides alternate statement and proof so the eye resets",
  "hashtags (weight 0.15) — mix of niche and category tags, no banned or spammy tags",
  "alt (weight 0.15) — does the alt text describe every frame for a screen reader",
].join("\n- ");

function brandBrief(brand: Brand) {
  return [
    `Brand: ${brand.name} (${brand.handle})`,
    `Positioning: ${brand.positioning}`,
    `Voice: ${brand.voice}`,
    `Writing style: ${brand.writingStyle}`,
    `Reading level: ${brand.readingLevel}`,
    `Colour theme: background ${brand.colorTheme.background}, foreground ${brand.colorTheme.foreground}, accent ${brand.colorTheme.accent}`,
    `Content pillars: ${brand.contentPillars.join(", ")}`,
    `Category: ${brand.category}`,
  ].join("\n");
}

export function brandProfile(brandId: BrandId) {
  return brandBrief(getBrand(brandId));
}

function system(role: string) {
  return `${role}\n\nRules:\n- ${OUTPUT_RULES}`;
}

function factsBlock(facts: ResearchOutput["facts"]) {
  return facts
    .map(
      (fact, index) =>
        `${index + 1}. ${fact.claim}\n   Evidence: ${fact.evidence}\n   Source: ${fact.sourceTitle} — ${fact.publisher} (${fact.sourceUrl || "no url"}) [${fact.confidence} confidence]`,
    )
    .join("\n");
}

/* -------------------------------------------------------------------------- */
/*  Step 1 — topic                                                            */
/* -------------------------------------------------------------------------- */

export interface TopicPromptInput {
  brandId: BrandId;
  /** Defaults to the brand's own category. */
  category?: PostCategory;
  /** Free-text steer from whoever pressed the button. */
  steer?: string;
  /** Headlines already used, so the engine does not repeat itself. */
  avoid?: string[];
  /**
   * The learning engine's weighting for this brand. Omitted when no analysis has
   * run, in which case the prompt says nothing about performance rather than
   * implying a preference it cannot support.
   */
  guidance?: TopicGuidance;
  /** ISO timestamp the post is being written for. */
  nowIso: string;
}

/** Renders the performance weighting as prompt lines. */
function weightingBlock(guidance: TopicGuidance | undefined): string {
  if (!guidance) return "";

  if (!guidance.measured) {
    return [
      "No performance weighting applies yet — choose on editorial merit alone.",
    ].join("\n");
  }

  const lines = [
    `Your own results over the last analysis (${guidance.note})`,
    "These are the directions open to you:",
    ...guidance.candidates.map(
      (candidate) =>
        `- ${candidate.label} (${candidate.multiplier}×${candidate.measured ? `, ${candidate.posts} posts, ${candidate.trend}` : ", not enough data yet"})`,
    ),
  ];

  if (guidance.preferred.length > 0) {
    lines.push(
      `Prefer a specific subject inside: ${guidance.preferred.map((entry) => entry.label).join(" or ")}.`,
    );
  }
  if (guidance.avoid.length > 0) {
    lines.push(
      `Underperforming, so avoid unless the editor's direction demands it: ${guidance.avoid
        .map((entry) => `${entry.label} (${entry.multiplier}×)`)
        .join(", ")}.`,
    );
  }
  lines.push(
    "Set \"topicKey\" to the exact slug of the direction you chose, from the list above.",
  );

  return lines.join("\n");
}

export function topicPrompt({
  brandId,
  category,
  steer,
  avoid = [],
  guidance,
  nowIso,
}: TopicPromptInput): PromptPair {
  const brand = getBrand(brandId);
  const resolvedCategory = category ?? brand.category;

  return {
    system: system(
      `You are a content strategist for ${brand.name}, an Instagram brand in the ${resolvedCategory} category. You pick one specific, defensible topic — never a generic theme. A good topic is something a reader could repeat at dinner.`,
    ),
    user: [
      brandBrief(brand),
      `Today is ${nowIso}.`,
      steer
        ? `The editor asked for this direction: ${steer}`
        : "Choose the strongest available topic for this brand right now.",
      avoid.length > 0
        ? `These topics were already published recently — do not repeat them:\n${avoid.map((title) => `- ${title}`).join("\n")}`
        : "There are no recent topics to avoid.",
      "",
      "Rules for picking a topic:",
      "- Name a specific case, number, or mechanism. Not \"the power of X\" but \"why X failed when Y happened\".",
      "- The topic should be arguable — a reader should be able to disagree with it.",
      "- Prefer topics that have a concrete number or outcome attached.",
      "- The angle should reveal something the reader did not know, not confirm what they already believe.",
      "",
      `"pillar" must be one of the brand's content pillars listed above.`,
      `"rationale" must explain WHY this topic will get saves and shares, not just what it is about.`,
      ...(guidance ? ["", weightingBlock(guidance)] : []),
      "",
      `Return JSON exactly like:\n${STEP_CONTRACTS.topic}`,
    ].join("\n"),
  };
}

/* -------------------------------------------------------------------------- */
/*  Step 2 — research                                                         */
/* -------------------------------------------------------------------------- */

export function researchPrompt({
  brandId,
  topic,
}: {
  brandId: BrandId;
  topic: TopicOutput;
}): PromptPair {
  const brand = getBrand(brandId);

  return {
    system: system(
      "You are a research assistant who finds real, verifiable facts. You are honest about what you cannot verify. You never invent sources or numbers.",
    ),
    user: [
      `Brand: ${brand.name} — ${brand.positioning}`,
      `Topic: ${topic.topic}`,
      `Angle: ${topic.angle}`,
      "",
      "Collect 4 to 8 facts that support the angle. For each fact:",
      "- state the claim as a specific, arguable sentence (not a vague generalization),",
      "- add the evidence behind it (a number, a study result, a named decision),",
      "- name the specific source (title, publisher, canonical url),",
      "- set confidence honestly: high only when you are confident the source exists and says this.",
      "",
      "Quality criteria for facts:",
      "- Prefer numbers over opinions (\"73% of...\" not \"many people think...\").",
      "- Prefer recent data (last 3 years) over older studies.",
      "- Prefer named sources (Harvard, McKinsey, a specific company) over anonymous ones.",
      "- Each fact should be useful on its own — someone could pull it out and share it.",
      "",
      "Then list genuine gaps: what a careful editor should double-check before publishing.",
      "",
      `Return JSON exactly like:\n${STEP_CONTRACTS.research}`,
    ].join("\n"),
  };
}

/* -------------------------------------------------------------------------- */
/*  Step 3 — verify                                                           */
/* -------------------------------------------------------------------------- */

export function verifyPrompt({
  brandId,
  research,
}: {
  brandId: BrandId;
  research: ResearchOutput;
}): PromptPair {
  const brand = getBrand(brandId);

  return {
    system: system(
      `You are a fact-checker for ${brand.name}. You are sceptical, and you would rather drop a claim than publish something unverifiable.`,
    ),
    user: [
      "Review each claim below.",
      "- supported: the claim is corroborated by a source you are confident exists and says this.",
      "- uncertain: plausible but you cannot corroborate it.",
      "- unsupported: no reliable basis, or the claim is too strong for the evidence.",
      "",
      "Then list every claim that must not be published, quoted verbatim from the list below.",
      "",
      factsBlock(research.facts),
      research.gaps.length > 0
        ? `\nKnown gaps flagged during research:\n${research.gaps.map((gap) => `- ${gap}`).join("\n")}`
        : "",
      "",
      `Return JSON exactly like:\n${STEP_CONTRACTS.verify}`,
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

/* -------------------------------------------------------------------------- */
/*  Step 4 — carousel                                                         */
/* -------------------------------------------------------------------------- */

export interface CarouselPromptInput {
  brandId: BrandId;
  topic: TopicOutput;
  research: ResearchOutput;
  verification: VerifyOutput;
}

function approvedFacts(research: ResearchOutput, verification: VerifyOutput) {
  const rejected = new Set(verification.rejected.map((claim) => claim.trim().toLowerCase()));
  const byVerdict = new Map(
    verification.claims.map((claim) => [claim.claim.trim().toLowerCase(), claim.verdict]),
  );

  return research.facts.filter((fact) => {
    const key = fact.claim.trim().toLowerCase();
    if (rejected.has(key)) return false;
    return byVerdict.get(key) !== "unsupported";
  });
}

export function carouselPrompt({
  brandId,
  topic,
  research,
  verification,
}: CarouselPromptInput): PromptPair {
  const brand = getBrand(brandId);
  const facts = approvedFacts(research, verification);

  return {
    system: system(
      `You are the art director and copywriter for ${brand.name}. You write carousels that stop the scroll and keep people swiping. Every slide earns the next one.`,
    ),
    user: [
      brandBrief(brand),
      `Topic: ${topic.topic}`,
      `Angle: ${topic.angle}`,
      "",
      "Verified facts you may use — use no other facts:",
      facts.length > 0 ? factsBlock(facts) : "No facts survived verification. Stay general and add no numbers.",
      "",
      "Build a 5 to 7 slide carousel. The goal is a post someone saves and sends to a colleague.",
      "",
      "Slide 1 (cover):",
      "- kind: cover",
      "- kicker: 1–2 word category label",
      "- headline: the hook, 6–10 words, no question marks, no clickbait. Make a claim the reader wants to argue with.",
      "- body: one sentence that frames why this matters right now",
      "",
      "Middle slides (3–5 slides):",
      "- Alternate between kind \"statement\" (big idea), \"list\" (rules or steps), \"statistic\" (a real number with context), and \"quote\" (a named source).",
      "- kicker: always 1–3 words (e.g. \"Rule 01\", \"The data\", \"What changed\")",
      "- headline: under 50 characters, reads as ${brand.readingLevel}. No jargon.",
      "- body: one sentence that backs the headline. Specific, not vague.",
      "- Include at least one \"statistic\" slide with a real number from the facts above. Never use a made-up number.",
      "",
      "Final slide (cta):",
      "- kind: cta",
      "- headline: an invitation, not a sales pitch. Fit ${brand.name}'s voice.",
      "- body: one sentence on what to do next.",
      "",
      "Rules:",
      "- Every headline must make sense on its own — people screenshot individual slides.",
      "- Never repeat the same idea across slides.",
      "- No emoji in any text field.",
      "- body is always one sentence. Never two.",
      "",
      `Return JSON exactly like:\n${STEP_CONTRACTS.carousel}`,
    ].join("\n"),
  };
}

/* -------------------------------------------------------------------------- */
/*  Step 5 — caption                                                          */
/* -------------------------------------------------------------------------- */

export function captionPrompt({
  brandId,
  topic,
  carousel,
}: {
  brandId: BrandId;
  topic: TopicOutput;
  carousel: { title: string; hook: string; slides: Array<{ headline: string; body: string }> };
}): PromptPair {
  const brand = getBrand(brandId);

  return {
    system: system(
      `You write Instagram captions for ${brand.name}. The first line must survive the "more" cut at roughly 125 characters. The caption should make someone stop scrolling, read, and save.`,
    ),
    user: [
      brandBrief(brand),
      `Topic: ${topic.topic}`,
      `Cover line: ${carousel.hook}`,
      `Slides:\n${carousel.slides.map((slide, index) => `${index + 1}. ${slide.headline} — ${slide.body}`).join("\n")}`,
      "",
      "Write one caption, 60–140 words:",
      "- line 1 is the hook restated as a claim the reader can argue with. Make it specific, not generic.",
      "- lines 2–3: expand with the strongest verified number or the most surprising fact. Be concrete.",
      "- line 4: one sentence on why this is not obvious — the tension or the counterintuitive angle.",
      "- close with a plain call to save or send it. No emoji, no hashtags, no links.",
      "",
      "Bad example: \"Write the rule down. That is the whole difference...\"",
      "Good example: \"73% of team decisions are never documented. The ones that survive are the ones someone wrote down before the next meeting.\"",
      "",
      `Return JSON exactly like:\n${STEP_CONTRACTS.caption}`,
    ].join("\n"),
  };
}

/* -------------------------------------------------------------------------- */
/*  Step 6 — hashtags                                                         */
/* -------------------------------------------------------------------------- */

export function hashtagsPrompt({
  brandId,
  topic,
  title,
}: {
  brandId: BrandId;
  topic: TopicOutput;
  title: string;
}): PromptPair {
  const brand = getBrand(brandId);

  return {
    system: system(
      "You pick Instagram hashtags that put a post in front of the right niche without looking like spam.",
    ),
    user: [
      `Brand: ${brand.name} (${brand.category})`,
      `Always carry: ${brand.hashtagBase.join(" ")}`,
      `Post title: ${title}`,
      `Topic: ${topic.topic}`,
      "",
      "Pick 6 to 9 tags: the brand tags above, two or three niche tags specific to this topic, and one or two category tags.",
      "Every tag must be lowercase, single-word or joined without spaces, and prefixed with #.",
      "No banned tags, no #viral / #fyp / #explore style tags, no duplicates.",
      "",
      `Return JSON exactly like:\n${STEP_CONTRACTS.hashtags}`,
    ].join("\n"),
  };
}

/* -------------------------------------------------------------------------- */
/*  Step 7 — alt text                                                         */
/* -------------------------------------------------------------------------- */

export function altTextPrompt({
  brandId,
  carousel,
}: {
  brandId: BrandId;
  carousel: { title: string; slides: Array<{ headline: string; body: string; kind: string }> };
}): PromptPair {
  const brand = getBrand(brandId);

  return {
    system: system(
      "You write alt text for carousels. Someone using a screen reader must come away with the same information as someone who swiped through.",
    ),
    user: [
      `Brand palette: ${brand.colorTheme.background} background, ${brand.colorTheme.foreground} type.`,
      `Post: ${carousel.title}`,
      `Frames:\n${carousel.slides.map((slide, index) => `${index + 1}. [${slide.kind}] ${slide.headline} — ${slide.body}`).join("\n")}`,
      "",
      "Write 2–4 sentences of continuous prose that:",
      "- says how many frames there are,",
      "- describes each frame in order and what it says (not what it looks like pixel by pixel),",
      "- avoids 'image of' and 'photo of' preamble.",
      "",
      `Return JSON exactly like:\n${STEP_CONTRACTS.alt_text}`,
    ].join("\n"),
  };
}

/* -------------------------------------------------------------------------- */
/*  Step 8 — quality                                                          */
/* -------------------------------------------------------------------------- */

export function qualityPrompt({
  brandId,
  payload,
  verification,
}: {
  brandId: BrandId;
  payload: { title: string; hook: string; caption: string; hashtags: string[]; altText: string; slides: Array<{ headline: string; body: string }> };
  verification: VerifyOutput;
}): PromptPair {
  const brand = getBrand(brandId);

  return {
    system: system(
      "You are a hard-to-please content reviewer. You score the post against a fixed rubric and you say exactly what would have to change.",
    ),
    user: [
      `Brand: ${brand.name} — ${brand.readingLevel}`,
      `Title: ${payload.title}`,
      `Hook: ${payload.hook}`,
      `Caption: ${payload.caption}`,
      `Hashtags: ${payload.hashtags.join(" ")}`,
      `Alt text: ${payload.altText}`,
      `Slides:\n${payload.slides.map((slide, index) => `${index + 1}. ${slide.headline} — ${slide.body}`).join("\n")}`,
      "",
      "Rubric — score each criterion 0–100 with its stated weight:",
      `- ${QUALITY_CRITERIA_BRIEF}`,
      "",
      "Rules:",
      "- disagree with yourself if the hook is weak; scores of 95+ should be rare.",
      "- 'blockers' lists anything that must change before approval. Use the exact criterion names.",
      "- 'score' is the weighted total, rounded to an integer.",
      verification.rejected.length > 0
        ? `- these claims were rejected during fact-checking and must appear as blockers if present: ${verification.rejected.join("; ")}`
        : "",
      "",
      `Return JSON exactly like:\n${STEP_CONTRACTS.quality}`,
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

/* -------------------------------------------------------------------------- */
/*  Single-call mode — every field in one structured response                  */
/* -------------------------------------------------------------------------- */

export function composePrompt({
  brandId,
  topic,
  research,
  verification,
}: CarouselPromptInput): PromptPair {
  const brand = getBrand(brandId);
  const facts = approvedFacts(research, verification);

  return {
    system: system(
      `You are the whole content team for ${brand.name}: strategist, art director, copywriter, accessibility reviewer and quality reviewer. You return one complete, publishable post. Every field must be filled. The post should feel like it was made by a human who cares about the brand.`,
    ),
    user: [
      brandBrief(brand),
      `Topic: ${topic.topic}`,
      `Angle: ${topic.angle}`,
      "",
      "Verified facts you may use — use no other facts:",
      facts.length > 0 ? factsBlock(facts) : "No facts survived verification. Stay general and add no numbers.",
      "",
      "Produce:",
      "",
      "1. title: working title, under 80 characters. Specific, not generic.",
      "2. hook: cover line, 6–10 words, no question marks. A claim the reader wants to argue with.",
      "3. slides: 5 to 7 frames.",
      "   - Slide 1: kind \"cover\". The hook in the headline.",
      "   - Middle slides: alternate \"statement\", \"list\", \"statistic\", \"quote\". At least one \"statistic\" with a real number from the facts.",
      "   - Final slide: kind \"cta\". An invitation, not a sales pitch.",
      "   - Each slide: kicker (1–3 words), headline (under 50 characters), body (one sentence), footnote (string or null).",
      "   - Every headline must make sense on its own — people screenshot individual slides.",
      "",
      "4. caption: 60–140 words.",
      "   - Line 1: the hook as a specific claim.",
      "   - Lines 2–3: the strongest verified number or fact. Be concrete.",
      "   - Line 4: why this is not obvious.",
      "   - Close: plain save/send invitation. No emoji, no hashtags, no links.",
      "",
      `5. hashtags: 6 to 9 lowercase tags prefixed with #, including ${brand.hashtagBase.join(" ")}. No #viral/#fyp/#explore.`,
      "6. altText: 2–4 sentences describing every frame in order, no 'image of' preamble.",
      "7. references: one entry per fact you actually used, with the real source and an honest credibility rating.",
      "",
      "8. qualityScore: score the post 0–100 against this rubric:",
      `   - ${QUALITY_CRITERIA_BRIEF}`,
      "   Scores of 95+ should be rare. List anything that must change before approval in blockers.",
      "",
      `Return JSON exactly like:\n${COMPOSED_CONTRACT}`,
    ].join("\n"),
  };
}

/* -------------------------------------------------------------------------- */
/*  Repair                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Used in two places: when a response will not parse as JSON at all, and when it
 * parses but fails schema validation. Sending the broken text back with the
 * contract is both cheaper and more reliable than regenerating from scratch.
 */
export function repairPrompt({
  broken,
  contract,
  problem,
}: {
  broken: string;
  contract: string;
  problem: string;
}): PromptPair {
  return {
    system: system(
      "You repair malformed JSON. You change as little as possible: you never invent new content, you only fix structure, quoting and missing required fields.",
    ),
    user: [
      "The JSON below is invalid or does not match the required contract.",
      `Problem: ${problem}`,
      "",
      "Required contract:",
      contract,
      "",
      "Rules:",
      "- keep every existing value, wording and ordering exactly as it is,",
      "- close any unterminated string or bracket, remove trailing commas, escape raw newlines,",
      "- if a required field is missing, add it with the shortest sensible value derived from the content already present,",
      "- if a value has the wrong type, convert it to the required type,",
      "- return the repaired JSON object only.",
      "",
      "Invalid JSON:",
      broken.slice(0, 12_000),
    ].join("\n"),
  };
}

/* -------------------------------------------------------------------------- */
/*  Prompt catalogue (shown in the AI logs UI)                                */
/* -------------------------------------------------------------------------- */

export interface PromptCatalogueEntry {
  step: AiStepId;
  label: string;
  purpose: string;
  contract: string;
}

export const PROMPT_CATALOGUE: PromptCatalogueEntry[] = [
  {
    step: "topic",
    label: "Topic",
    purpose: "Chooses one specific, defensible topic inside the brand's pillars.",
    contract: STEP_CONTRACTS.topic,
  },
  {
    step: "research",
    label: "Research",
    purpose: "Collects verifiable facts with sources, plus an honest list of gaps.",
    contract: STEP_CONTRACTS.research,
  },
  {
    step: "verify",
    label: "Verify facts",
    purpose: "Fact-checks each claim and names the ones that must not ship.",
    contract: STEP_CONTRACTS.verify,
  },
  {
    step: "carousel",
    label: "Carousel",
    purpose: "Builds slide structure and copy from verified facts only.",
    contract: STEP_CONTRACTS.carousel,
  },
  {
    step: "caption",
    label: "Caption",
    purpose: "Writes the caption with a hook that survives the 125-character cut.",
    contract: STEP_CONTRACTS.caption,
  },
  {
    step: "hashtags",
    label: "Hashtags",
    purpose: "Mixes brand, niche and category tags without spam patterns.",
    contract: STEP_CONTRACTS.hashtags,
  },
  {
    step: "alt_text",
    label: "Alt text",
    purpose: "Describes every frame so the post reads without images.",
    contract: STEP_CONTRACTS.alt_text,
  },
  {
    step: "quality",
    label: "Quality score",
    purpose: "Scores the post against the five-criterion rubric and lists blockers.",
    contract: STEP_CONTRACTS.quality,
  },
];

/** Which contract text matches a step — used by the repair call. */
export function contractForStep(step: AiStepId) {
  return STEP_CONTRACTS[step];
}

export { COMPOSED_CONTRACT };
