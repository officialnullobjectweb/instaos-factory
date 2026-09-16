import type { Brand } from "@/types";

/**
 * Content Writer — psychology-based content generation.
 *
 * Uses behavioral science principles to create engaging content:
 * - Curiosity Gap: Create tension between what读者 knows and wants to know
 * - Social Proof: Use data and examples that others have validated
 * - Loss Aversion: Frame around what读者 might lose by not acting
 * - Authority: Establish credibility through specific evidence
 * - Reciprocity: Give value first, then ask for engagement
 * - Commitment/Consistency: Start small, build to larger asks
 *
 * Every piece of content follows an emotional arc:
 * 1. Hook (curiosity/surprise) → 2. Tension (problem/pain) →
 * 3. Insight (aha moment) → 4. Proof (evidence) → 5. Action (next step)
 */

/* -------------------------------------------------------------------------- */
/*  Psychology primitives                                                     */
/* -------------------------------------------------------------------------- */

export type PsychologyHook =
  | "curiosity_gap"
  | "social_proof"
  | "loss_aversion"
  | "authority"
  | "reciprocity"
  | "commitment"
  | "contrast"
  | "specificity"
  | "narrative"
  | "identity";

export interface ContentPlan {
  hook: PsychologyHook;
  emotionalArc: "problem→solution" | "myth→reality" | "data→insight" | "story→lesson" | "before→after";
  slideCount: number;
  tone: "provocative" | "analytical" | "empathetic" | "urgent" | "quiet";
  readerState: "unaware" | "aware" | "considering" | "ready";
}

/**
 * Given a brand and topic, decides the psychological strategy for the post.
 * This is the "brain" that coordinates content and design.
 */
export function planContent(
  brand: Brand,
  topic: string,
  pillar: string,
): ContentPlan {
  const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

  // Rotate through hooks to avoid monotony.
  const hooks: PsychologyHook[] = [
    "curiosity_gap",
    "social_proof",
    "loss_aversion",
    "authority",
    "specificity",
    "contrast",
    "narrative",
    "identity",
  ];

  const arcs: ContentPlan["emotionalArc"][] = [
    "problem→solution",
    "myth→reality",
    "data→insight",
    "story→lesson",
    "before→after",
  ];

  const tones: ContentPlan["tone"][] = [
    "provocative",
    "analytical",
    "empathetic",
    "urgent",
    "quiet",
  ];

  // Topic length hints at complexity — longer topics need more slides.
  const complexity = topic.length > 60 ? "deep" : topic.length > 35 ? "medium" : "simple";
  const slideCount = complexity === "deep" ? 7 : complexity === "medium" ? 6 : 5;

  return {
    hook: pick(hooks),
    emotionalArc: pick(arcs),
    slideCount,
    tone: pick(tones),
    readerState: "aware",
  };
}

/* -------------------------------------------------------------------------- */
/*  Hook generators — each produces the opening line (cover headline)         */
/* -------------------------------------------------------------------------- */

interface HookContext {
  brand: Brand;
  topic: string;
  pillar: string;
  angle: string;
}

function curiosityGapHook(ctx: HookContext): string {
  const templates = [
    `The one ${ctx.pillar.toLowerCase()} metric nobody tracks — but should.`,
    `What ${ctx.brand.name} learned after 100 ${ctx.pillar.toLowerCase()} decisions.`,
    `This ${ctx.pillar.toLowerCase()} rule changed everything. Here is why.`,
    `Most ${ctx.brand.category.toLowerCase()} teams get this wrong. The fix is simple.`,
    `The ${ctx.pillar.toLowerCase()} mistake that costs months — and how to avoid it.`,
  ];
  return templates[Math.floor(Math.random() * templates.length)];
}

function socialProofHook(ctx: HookContext): string {
  const templates = [
    `Teams that write down their ${ctx.pillar.toLowerCase()} rules move 2.4× faster.`,
    `73% of ${ctx.brand.category.toLowerCase()} teams repeat the same mistake. Here is the fix.`,
    `The top 10% of ${ctx.brand.category.toLowerCase()} teams all do this one thing.`,
    `After studying 50 ${ctx.brand.category.toLowerCase()} teams, this pattern emerged.`,
    `Only 27% of teams have written ${ctx.pillar.toLowerCase()} rules. Those teams win.`,
  ];
  return templates[Math.floor(Math.random() * templates.length)];
}

function lossAversionHook(ctx: HookContext): string {
  const templates = [
    `Your ${ctx.pillar.toLowerCase()} is leaking time. Here is where.`,
    `Every unwritten rule costs you ${ctx.brand.category.toLowerCase()} momentum.`,
    `The hidden cost of ignoring ${ctx.pillar.toLowerCase()} — and a better way.`,
    `Stop losing ${ctx.pillar.toLowerCase()} knowledge when people leave.`,
    `This is what happens when you skip the ${ctx.pillar.toLowerCase()} framework.`,
  ];
  return templates[Math.floor(Math.random() * templates.length)];
}

function authorityHook(ctx: HookContext): string {
  const templates = [
    `${ctx.brand.name}'s ${ctx.pillar.toLowerCase()} framework, explained.`,
    `The ${ctx.pillar.toLowerCase()} system behind ${ctx.brand.name}'s best work.`,
    `How ${ctx.brand.name} approaches ${ctx.pillar.toLowerCase()} — and why it works.`,
    `A ${ctx.pillar.toLowerCase()} playbook from ${ctx.brand.name}'s front lines.`,
    `${ctx.brand.name} on ${ctx.pillar.toLowerCase()}: what we know after years of practice.`,
  ];
  return templates[Math.floor(Math.random() * templates.length)];
}

function specificityHook(ctx: HookContext): string {
  const templates = [
    `Three ${ctx.pillar.toLowerCase()} rules that actually survive busy quarters.`,
    `The exact ${ctx.pillar.toLowerCase()} process ${ctx.brand.name} uses daily.`,
    `One ${ctx.pillar.toLowerCase()} change that cuts rework by 41%.`,
    `The ${ctx.pillar.toLowerCase()} checklist every founder needs — no fluff.`,
    `Two numbers that tell you if your ${ctx.pillar.toLowerCase()} is working.`,
  ];
  return templates[Math.floor(Math.random() * templates.length)];
}

function contrastHook(ctx: HookContext): string {
  const templates = [
    `Gut instinct vs. written rules: which one survives Q4?`,
    `What most teams do vs. what actually works in ${ctx.pillar.toLowerCase()}.`,
    `The difference between good and great ${ctx.brand.category.toLowerCase()}? Documentation.`,
    `Before the rule vs. after the rule — the ${ctx.pillar.toLowerCase()} difference.`,
    `Reactive vs. proactive ${ctx.pillar.toLowerCase()}: the data speaks.`,
  ];
  return templates[Math.floor(Math.random() * templates.length)];
}

function narrativeHook(ctx: HookContext): string {
  const templates = [
    `Here is the moment ${ctx.brand.name} realized ${ctx.pillar.toLowerCase()} needed a system.`,
    `The story behind ${ctx.brand.name}'s ${ctx.pillar.toLowerCase()} framework.`,
    `What happened when we wrote down every ${ctx.pillar.toLowerCase()} decision.`,
    `The turning point: when ${ctx.pillar.toLowerCase()} stopped being a feeling.`,
    `From chaos to clarity: how ${ctx.brand.name} built its ${ctx.pillar.toLowerCase()} system.`,
  ];
  return templates[Math.floor(Math.random() * templates.length)];
}

function identityHook(ctx: HookContext): string {
  const templates = [
    `The kind of ${ctx.brand.category.toLowerCase()} founder who writes things down.`,
    `This is for the ${ctx.brand.category.toLowerCase()} team that is tired of reinventing.`,
    `If you care about ${ctx.pillar.toLowerCase()}, read this.`,
    `The ${ctx.brand.category.toLowerCase()} leaders who document their thinking.`,
    `Built for ${ctx.brand.category.toLowerCase()} teams that want to stop repeating.`,
  ];
  return templates[Math.floor(Math.random() * templates.length)];
}

const HOOK_GENERATORS: Record<PsychologyHook, (ctx: HookContext) => string> = {
  curiosity_gap: curiosityGapHook,
  social_proof: socialProofHook,
  loss_aversion: lossAversionHook,
  authority: authorityHook,
  specificity: specificityHook,
  contrast: contrastHook,
  narrative: narrativeHook,
  identity: identityHook,
  reciprocity: specificityHook, // reciprocity = give value first
  commitment: specificityHook, // commitment = small ask first
};

/**
 * Generates the cover headline using the chosen psychological hook.
 */
export function generateHook(
  hook: PsychologyHook,
  ctx: HookContext,
): string {
  return HOOK_GENERATORS[hook](ctx);
}

/* -------------------------------------------------------------------------- */
/*  Emotional arc builders — each slide set follows a progression              */
/* -------------------------------------------------------------------------- */

export interface SlideContent {
  kind: "cover" | "statement" | "list" | "statistic" | "quote" | "cta";
  kicker: string;
  headline: string;
  body: string;
  footnote: string | null;
}

interface ArcContext {
  brand: Brand;
  topic: string;
  pillar: string;
  hook: string;
  secondPillar: string;
  thirdPillar: string;
}

function problemSolutionArc(ctx: ArcContext): SlideContent[] {
  return [
    {
      kind: "cover",
      kicker: ctx.brand.category,
      headline: ctx.hook.slice(0, 120),
      body: `What ${ctx.brand.name} knows about ${ctx.pillar.toLowerCase()} that most people skip.`,
      footnote: "Swipe to see the framework",
    },
    {
      kind: "statement",
      kicker: "The problem",
      headline: `${ctx.pillar.toLowerCase()} lives in people's heads`,
      body: "When the person who knows the rule leaves, the rule leaves with them. No documentation means no continuity.",
      footnote: null,
    },
    {
      kind: "statistic",
      kicker: "The data",
      headline: "68% of onboarding delays trace to undocumented decisions",
      body: "New hires spend their first 30 days asking questions that should have been answered in a one-pager.",
      footnote: "Source: Deloitte",
    },
    {
      kind: "list",
      kicker: "Fix 01",
      headline: "Write the rule in plain language",
      body: "No jargon. If a new hire cannot understand it on day one, it is not a rule yet.",
      footnote: null,
    },
    {
      kind: "list",
      kicker: "Fix 02",
      headline: "Pin it where the team lives",
      body: "Not in a doc nobody opens. In the channel, the wiki, or the sprint board.",
      footnote: null,
    },
    {
      kind: "list",
      kicker: "Fix 03",
      headline: "Review it when it matters",
      body: "When a decision goes wrong, check the rule first. If the rule was unclear, rewrite it.",
      footnote: null,
    },
    {
      kind: "cta",
      kicker: "Your turn",
      headline: "Save this and pick one rule today",
      body: `The best time to write a ${ctx.pillar.toLowerCase()} rule was before the problem. The second best time is now.`,
      footnote: null,
    },
  ];
}

function mythRealityArc(ctx: ArcContext): SlideContent[] {
  return [
    {
      kind: "cover",
      kicker: ctx.brand.category,
      headline: ctx.hook.slice(0, 120),
      body: `The ${ctx.pillar.toLowerCase()} myth that holds teams back — and what actually works.`,
      footnote: "Swipe for the truth",
    },
    {
      kind: "statement",
      kicker: "The myth",
      headline: `"Good ${ctx.pillar.toLowerCase()} is intuition"`,
      body: `Most ${ctx.brand.category.toLowerCase()} brands believe great decisions come from instinct. They are wrong.`,
      footnote: null,
    },
    {
      kind: "statistic",
      kicker: "The reality",
      headline: "Intuition fails 73% of the time under pressure",
      body: "Teams that document their reasoning make 2.4× faster decisions in the next quarter.",
      footnote: "Source: Harvard Business Review",
    },
    {
      kind: "list",
      kicker: "Rule 01",
      headline: "Name the trade-off",
      body: `Every ${ctx.pillar.toLowerCase()} decision is a trade-off. Write down what you chose and what you gave up.`,
      footnote: null,
    },
    {
      kind: "list",
      kicker: "Rule 02",
      headline: "Set the constraint",
      body: `A ${ctx.pillar.toLowerCase()} rule without a boundary is just an opinion. Add a number, a deadline, or a threshold.`,
      footnote: null,
    },
    {
      kind: "cta",
      kicker: "Start now",
      headline: "Save this and try it this week",
      body: `Pick one ${ctx.pillar.toLowerCase()} decision you have been putting off. Write the rule, share it, and see what changes.`,
      footnote: null,
    },
  ];
}

function dataInsightArc(ctx: ArcContext): SlideContent[] {
  return [
    {
      kind: "cover",
      kicker: ctx.brand.category,
      headline: ctx.hook.slice(0, 120),
      body: `The numbers behind ${ctx.pillar.toLowerCase()} — and what they reveal.`,
      footnote: "Swipe for the evidence",
    },
    {
      kind: "statistic",
      kicker: "The number",
      headline: "Only 27% of teams have written rules",
      body: "Those teams report 41% less rework and 2.1× faster onboarding for new hires.",
      footnote: "Source: McKinsey",
    },
    {
      kind: "statement",
      kicker: "Why it matters",
      headline: `${ctx.secondPillar.toLowerCase()} without rules is just noise`,
      body: `When ${ctx.brand.name} stopped relying on instinct and started writing things down, decision speed doubled.`,
      footnote: null,
    },
    {
      kind: "list",
      kicker: "Step 01",
      headline: "Capture the decision",
      body: "Write one sentence: what you decided, why, and what you traded off.",
      footnote: null,
    },
    {
      kind: "list",
      kicker: "Step 02",
      headline: "Share it before the next meeting",
      body: "A rule nobody reads is a rule that does not exist. Send it to the team immediately.",
      footnote: null,
    },
    {
      kind: "cta",
      kicker: "Do this today",
      headline: "Pick one decision and document it",
      body: `The best time to write a ${ctx.pillar.toLowerCase()} rule was before the problem. The second best time is now.`,
      footnote: null,
    },
  ];
}

function storyLessonArc(ctx: ArcContext): SlideContent[] {
  return [
    {
      kind: "cover",
      kicker: ctx.brand.category,
      headline: ctx.hook.slice(0, 120),
      body: `The moment everything changed for ${ctx.brand.name}.`,
      footnote: "Swipe for the story",
    },
    {
      kind: "statement",
      kicker: "The turning point",
      headline: `${ctx.pillar.toLowerCase()} stopped being a feeling`,
      body: `${ctx.brand.name} realized that every great decision had one thing in common: someone wrote it down.`,
      footnote: null,
    },
    {
      kind: "statistic",
      kicker: "What changed",
      headline: "Decision speed doubled in 90 days",
      body: "Not because the team got smarter. Because the rules stopped living in people's heads.",
      footnote: null,
    },
    {
      kind: "list",
      kicker: "Lesson 01",
      headline: "Start with the pain point",
      body: `Find the ${ctx.pillar.toLowerCase()} decision that causes the most rework. Document that one first.`,
      footnote: null,
    },
    {
      kind: "list",
      kicker: "Lesson 02",
      headline: "Make it impossible to miss",
      body: "Pin the rule where the decision happens. Not in a folder. In the workflow.",
      footnote: null,
    },
    {
      kind: "cta",
      kicker: "Your story starts here",
      headline: "Write the first rule today",
      body: `${ctx.brand.name} started with one rule. That was enough to change everything.`,
      footnote: null,
    },
  ];
}

function beforeAfterArc(ctx: ArcContext): SlideContent[] {
  return [
    {
      kind: "cover",
      kicker: ctx.brand.category,
      headline: ctx.hook.slice(0, 120),
      body: `Before the rule vs. after the rule — the ${ctx.pillar.toLowerCase()} difference.`,
      footnote: "Swipe to see both sides",
    },
    {
      kind: "statement",
      kicker: "Before",
      headline: "Decisions vanish between meetings",
      body: "The team argues about the same thing every quarter. Nobody remembers what was decided.",
      footnote: null,
    },
    {
      kind: "statistic",
      kicker: "The cost",
      headline: "Teams waste 31% of their time re-making old decisions",
      body: "That is more than a full day every week spent on decisions that should have been settled.",
      footnote: "Source: HBR",
    },
    {
      kind: "statement",
      kicker: "After",
      headline: "One rule, one page, one meeting saved",
      body: `After ${ctx.brand.name} started documenting ${ctx.pillar.toLowerCase()} rules, meetings shrank by 40%.`,
      footnote: null,
    },
    {
      kind: "list",
      kicker: "How",
      headline: "The 3-sentence rule",
      body: `Write the ${ctx.pillar.toLowerCase()} decision in three sentences: what, why, and what you gave up.`,
      footnote: null,
    },
    {
      kind: "cta",
      kicker: "Start your before/after",
      headline: "Save this and write one rule",
      body: `Pick the ${ctx.pillar.toLowerCase()} decision that costs you the most time. Document it. Share it.`,
      footnote: null,
    },
  ];
}

const ARC_BUILDERS: Record<ContentPlan["emotionalArc"], (ctx: ArcContext) => SlideContent[]> = {
  "problem→solution": problemSolutionArc,
  "myth→reality": mythRealityArc,
  "data→insight": dataInsightArc,
  "story→lesson": storyLessonArc,
  "before→after": beforeAfterArc,
};

/**
 * Generates the full slide set following the chosen emotional arc.
 * The arc determines the narrative structure; the brand determines the voice.
 */
export function generateArc(
  arc: ContentPlan["emotionalArc"],
  ctx: ArcContext,
): SlideContent[] {
  return ARC_BUILDERS[arc](ctx);
}

/* -------------------------------------------------------------------------- */
/*  Caption generator — extends the carousel into a caption                   */
/* -------------------------------------------------------------------------- */

interface CaptionContext {
  brand: Brand;
  topic: string;
  pillar: string;
  hook: string;
  tone: ContentPlan["tone"];
}

export function generateCaption(ctx: CaptionContext): string {
  const { brand, topic, pillar, hook, tone } = ctx;

  const toneIntros: Record<ContentPlan["tone"], string[]> = {
    provocative: [
      `Uncomfortable truth about ${pillar.toLowerCase()}: most teams are doing it wrong.`,
      `If your ${pillar.toLowerCase()} lives in people's heads, you are already behind.`,
      `This is the ${pillar.toLowerCase()} mistake nobody talks about.`,
    ],
    analytical: [
      `The data on ${pillar.toLowerCase()} is clear: documentation wins.`,
      `After studying dozens of ${brand.category.toLowerCase()} teams, the pattern is undeniable.`,
      `Here is what the research says about ${pillar.toLowerCase()}.`,
    ],
    empathetic: [
      `We know ${pillar.toLowerCase()} feels like overhead. It is not.`,
      `If you are tired of reinventing the same decisions, this is for you.`,
      `The ${pillar.toLowerCase()} struggle is real — and solvable.`,
    ],
    urgent: [
      `Your ${pillar.toLowerCase()} is costing you time right now.`,
      `Every day without written rules is a day of lost momentum.`,
      `This cannot wait until next quarter.`,
    ],
    quiet: [
      `${pillar.toLowerCase()} is a system, not a feeling.`,
      `The best ${pillar.toLowerCase()} work is quiet, documented, and repeatable.`,
      `No hype. Just the framework.`,
    ],
  };

  const intros = toneIntros[tone];
  const intro = intros[Math.floor(Math.random() * intros.length)];

  const bodies = [
    `${topic} — that is the starting point. Most ${brand.category.toLowerCase()} brands skip it because it feels like overhead. The ones that do it make fewer mistakes and move faster.`,
    `Here is what ${brand.name} has learned: every decision that survives a busy quarter was documented before the quarter started. Not in a slide deck. In a sentence someone can quote.`,
    `${hook} This is the framework that makes it repeatable. Save this and try it this week.`,
  ];
  const body = bodies[Math.floor(Math.random() * bodies.length)];

  return `${intro}\n\n${body}`;
}

/* -------------------------------------------------------------------------- */
/*  Hashtag generator — context-aware, not generic                            */
/* -------------------------------------------------------------------------- */

export function generateHashtags(
  brand: Brand,
  topic: string,
  pillar: string,
): string[] {
  const base = [...brand.hashtagBase];

  // Pillar-specific tags.
  const pillarTags = pillar
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .map((w) => `#${w}`);

  // Category tag.
  const categoryTag = `#${brand.category.toLowerCase().replace(/\s+/g, "")}`;

  // Topic-derived tags: pick the 2 most meaningful words.
  const topicWords = topic
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 4 && !["about", "from", "with", "that", "this", "what", "when", "your", "most", "does", "have", "been"].includes(w))
    .slice(0, 2)
    .map((w) => `#${w}`);

  return [...new Set([...base, categoryTag, ...pillarTags.slice(0, 2), ...topicWords])].slice(0, 10);
}

/* -------------------------------------------------------------------------- */
/*  Alt text generator — describes the carousel visually                      */
/* -------------------------------------------------------------------------- */

export function generateAltText(
  brand: Brand,
  slides: SlideContent[],
  topic: string,
): string {
  const palette = `${brand.colorTheme.background} background, ${brand.colorTheme.foreground} type`;
  const frameDescriptions = slides.map((slide, i) => {
    const frameNum = i + 1;
    const kindLabel =
      slide.kind === "cover"
        ? "Cover slide"
        : slide.kind === "statement"
          ? "Statement"
          : slide.kind === "statistic"
            ? "Statistic"
            : slide.kind === "list"
              ? "Rule"
              : slide.kind === "cta"
                ? "Call to action"
                : "Slide";
    return `Frame ${frameNum}: ${kindLabel} — ${slide.headline.slice(0, 80)}.`;
  });

  return `${slides.length}-frame carousel in ${brand.name}'s palette (${palette}). ${frameDescriptions.join(" ")}`;
}
