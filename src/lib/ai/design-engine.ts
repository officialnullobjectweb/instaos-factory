import type { Brand } from "@/types";
import type { ContentPlan, SlideContent } from "./content-writer";

/**
 * Design Engine — visual design system that coordinates with content.
 *
 * Principles:
 * 1. Visual hierarchy guides the eye in the right order
 * 2. Color psychology matches the emotional tone
 * 3. Typography matches the content's voice
 * 4. Layout adapts to content type
 * 5. Whitespace creates focus and breathing room
 * 6. Contrast highlights key information
 *
 * The design engine does NOT generate visual assets — it defines the
 * visual rules that the rendering layer follows. This keeps the offline
 * engine testable without a browser.
 */

/* -------------------------------------------------------------------------- */
/*  Design types                                                              */
/* -------------------------------------------------------------------------- */

export type LayoutStyle =
  | "editorial" // Clean, text-forward, minimal
  | "data-driven" // Numbers prominent, charts implied
  | "narrative" // Story flow, emotional imagery
  | "minimalist" // Maximum whitespace, one idea per slide
  | "bold" // High contrast, strong typography
  | "grid"; // Structured, systematic

export type TypographyMode =
  | "headline" // Large, bold, attention-grabbing
  | "body" // Readable, comfortable
  | "caption" // Small, supporting text
  | "stat" // Number-forward, data emphasis
  | "quote" // Larger, reflective, attributed

export interface DesignSpec {
  layout: LayoutStyle;
  typography: TypographyMode[];
  colorRole: "primary" | "accent" | "muted";
  spacing: "tight" | "normal" | "airy";
  emphasis: "text" | "number" | "equal";
  visualWeight: "cover-heavy" | "balanced" | "end-heavy";
}

/* -------------------------------------------------------------------------- */
/*  Design selection — matches content plan to visual approach                */
/* -------------------------------------------------------------------------- */

/**
 * Given a content plan and brand, selects the design approach.
 * This is the coordination point between content and design.
 */
export function selectDesign(
  plan: ContentPlan,
  brand: Brand,
): DesignSpec {
  const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

  // Layout matches the emotional arc.
  const arcLayouts: Record<ContentPlan["emotionalArc"], LayoutStyle[]> = {
    "problem→solution": ["editorial", "minimalist"],
    "myth→reality": ["bold", "editorial"],
    "data→insight": ["data-driven", "grid"],
    "story→lesson": ["narrative", "editorial"],
    "before→after": ["bold", "minimalist"],
  };

  // Tone determines typography.
  const toneTypography: Record<ContentPlan["tone"], TypographyMode[]> = {
    provocative: ["headline", "stat"],
    analytical: ["stat", "body"],
    empathetic: ["body", "quote"],
    urgent: ["headline", "stat"],
    quiet: ["body", "caption"],
  };

  const layout = pick(arcLayouts[plan.emotionalArc]);
  const typography = toneTypography[plan.tone];

  // Spacing matches reader state.
  const spacing = plan.readerState === "unaware" ? "airy" : "normal";

  // Emphasis: stat-heavy arcs emphasize numbers, others emphasize text.
  const emphasis = plan.emotionalArc === "data→insight" ? "number" : "text";

  // Visual weight: CTA-heavy arcs weight the end, covers weight the start.
  const visualWeight = plan.slideCount >= 7 ? "end-heavy" : "balanced";

  return {
    layout,
    typography,
    colorRole: plan.tone === "provocative" || plan.tone === "urgent" ? "accent" : "primary",
    spacing,
    emphasis,
    visualWeight,
  };
}

/* -------------------------------------------------------------------------- */
/*  Slide design — applies design spec to individual slides                   */
/* -------------------------------------------------------------------------- */

export interface DesignedSlide extends SlideContent {
  design: {
    layout: LayoutStyle;
    typography: TypographyMode;
    colorRole: "primary" | "accent" | "muted";
    spacing: "tight" | "normal" | "airy";
    emphasis: "text" | "number" | "equal";
  };
}

/**
 * Applies the design spec to each slide, determining how it should be
 * rendered visually. The rendering layer reads these properties.
 */
export function designSlides(
  slides: SlideContent[],
  spec: DesignSpec,
  brand: Brand,
): DesignedSlide[] {
  return slides.map((slide, index) => {
    const isFirst = index === 0;
    const isLast = index === slides.length - 1;
    const isMiddle = !isFirst && !isLast;

    // Typography varies by slide position and kind.
    let typography: TypographyMode;
    if (slide.kind === "cover") {
      typography = "headline";
    } else if (slide.kind === "statistic") {
      typography = "stat";
    } else if (slide.kind === "quote") {
      typography = "quote";
    } else if (isLast) {
      typography = "body";
    } else if (isMiddle && slide.kind === "list") {
      typography = "body";
    } else {
      typography = spec.typography[0];
    }

    // Color role: covers and CTAs get accent, everything else gets primary or muted.
    let colorRole: "primary" | "accent" | "muted";
    if (slide.kind === "cover" || slide.kind === "cta") {
      colorRole = "accent";
    } else if (slide.kind === "statement" || slide.kind === "quote") {
      colorRole = "primary";
    } else {
      colorRole = spec.colorRole;
    }

    // Spacing: covers are airy, lists are tight, everything else follows spec.
    let spacing: "tight" | "normal" | "airy";
    if (slide.kind === "cover") {
      spacing = "airy";
    } else if (slide.kind === "list") {
      spacing = "tight";
    } else {
      spacing = spec.spacing;
    }

    // Emphasis: statistics always emphasize numbers, CTAs emphasize text.
    let emphasis: "text" | "number" | "equal";
    if (slide.kind === "statistic") {
      emphasis = "number";
    } else if (slide.kind === "cta") {
      emphasis = "text";
    } else {
      emphasis = spec.emphasis;
    }

    return {
      ...slide,
      design: {
        layout: spec.layout,
        typography,
        colorRole,
        spacing,
        emphasis,
      },
    };
  });
}

/* -------------------------------------------------------------------------- */
/*  Content-design coordination rules                                         */
/* -------------------------------------------------------------------------- */

/**
 * Ensures content length matches design capacity.
 *
 * Rules:
 * - Cover slides: headline ≤ 120 chars, body ≤ 80 chars
 * - Statement slides: headline ≤ 100 chars, body ≤ 160 chars
 * - Statistic slides: headline ≤ 80 chars (number-forward), body ≤ 120 chars
 * - List slides: headline ≤ 60 chars, body ≤ 120 chars
 * - CTA slides: headline ≤ 80 chars, body ≤ 120 chars
 *
 * If content exceeds limits, it is trimmed to fit.
 */
export function enforceContentDesignLimits(
  slides: DesignedSlide[],
): DesignedSlide[] {
  return slides.map((slide) => {
    const limits = {
      cover: { headline: 120, body: 80 },
      statement: { headline: 100, body: 160 },
      statistic: { headline: 80, body: 120 },
      list: { headline: 60, body: 120 },
      quote: { headline: 100, body: 160 },
      cta: { headline: 80, body: 120 },
    }[slide.kind];

    return {
      ...slide,
      headline: slide.headline.slice(0, limits.headline),
      body: slide.body.slice(0, limits.body),
    };
  });
}

/* -------------------------------------------------------------------------- */
/*  Quality scoring — evaluates content-design coordination                   */
/* -------------------------------------------------------------------------- */

export interface DesignQualityReport {
  score: number;
  criteria: Array<{
    id: string;
    label: string;
    weight: number;
    score: number;
    note: string;
  }>;
}

/**
 * Scores the content-design coordination on a 0-100 scale.
 * Used by the quality step to evaluate the offline engine's output.
 */
export function scoreDesignQuality(
  slides: DesignedSlide[],
  plan: ContentPlan,
): DesignQualityReport {
  const criteria = [
    {
      id: "arc",
      label: "Emotional arc completeness",
      weight: 0.25,
      score: scoreArcCompleteness(slides, plan),
      note: `Uses ${plan.emotionalArc} arc with ${slides.length} slides.`,
    },
    {
      id: "hook",
      label: "Hook strength",
      weight: 0.2,
      score: scoreHookStrength(slides[0]),
      note: `${plan.hook} hook on cover slide.`,
    },
    {
      id: "variety",
      label: "Slide kind variety",
      weight: 0.15,
      score: scoreVariety(slides),
      note: `${new Set(slides.map((s) => s.kind)).size} unique slide kinds.`,
    },
    {
      id: "pacing",
      label: "Content pacing",
      weight: 0.2,
      score: scorePacing(slides),
      note: `${slides.length} slides with ${plan.tone} tone.`,
    },
    {
      id: "cta",
      label: "Call-to-action clarity",
      weight: 0.1,
      score: scoreCTA(slides[slides.length - 1]),
      note: slides[slides.length - 1].kind === "cta" ? "CTA present." : "No CTA.",
    },
    {
      id: "coordination",
      label: "Content-design match",
      weight: 0.1,
      score: scoreCoordination(slides, plan),
      note: `Design matches ${plan.emotionalArc} arc and ${plan.tone} tone.`,
    },
  ];

  const totalScore = Math.round(
    criteria.reduce((sum, c) => sum + c.score * c.weight, 0),
  );

  return { score: totalScore, criteria };
}

function scoreArcCompleteness(slides: DesignedSlide[], plan: ContentPlan): number {
  const kinds = slides.map((s) => s.kind);
  const hasCover = kinds[0] === "cover";
  const hasCTA = kinds[kinds.length - 1] === "cta";
  const hasMiddle = kinds.slice(1, -1).some((k) => k !== "cover" && k !== "cta");

  let score = 0;
  if (hasCover) score += 40;
  if (hasCTA) score += 30;
  if (hasMiddle) score += 30;
  return score;
}

function scoreHookStrength(cover: DesignedSlide): number {
  if (!cover) return 0;
  let score = 0;
  // Shorter headlines are stronger.
  if (cover.headline.length <= 80) score += 40;
  else if (cover.headline.length <= 120) score += 25;
  else score += 10;
  // Has a body that complements.
  if (cover.body.length > 20) score += 30;
  // Has a footnote (swipe prompt).
  if (cover.footnote) score += 30;
  return score;
}

function scoreVariety(slides: DesignedSlide[]): number {
  const uniqueKinds = new Set(slides.map((s) => s.kind)).size;
  // 3+ unique kinds is good, 2 is okay, 1 is bad.
  if (uniqueKinds >= 4) return 100;
  if (uniqueKinds === 3) return 80;
  if (uniqueKinds === 2) return 50;
  return 20;
}

function scorePacing(slides: DesignedSlide[]): number {
  // Good pacing: not too many of the same kind in a row.
  let maxConsecutive = 1;
  let currentConsecutive = 1;
  for (let i = 1; i < slides.length; i++) {
    if (slides[i].kind === slides[i - 1].kind) {
      currentConsecutive++;
      maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
    } else {
      currentConsecutive = 1;
    }
  }
  // 3+ consecutive same kind is bad.
  if (maxConsecutive <= 2) return 100;
  if (maxConsecutive === 3) return 60;
  return 30;
}

function scoreCTA(slide: DesignedSlide): number {
  if (!slide || slide.kind !== "cta") return 0;
  let score = 0;
  if (slide.headline.length <= 80) score += 50;
  else score += 20;
  if (slide.body.length > 20) score += 50;
  return score;
}

function scoreCoordination(slides: DesignedSlide[], plan: ContentPlan): number {
  // Check that the design matches the plan.
  let score = 0;
  const firstDesign = slides[0]?.design;
  if (!firstDesign) return 0;

  // Layout should match arc.
  if (plan.emotionalArc === "data→insight" && firstDesign.layout === "data-driven") score += 50;
  else if (plan.emotionalArc === "story→lesson" && firstDesign.layout === "narrative") score += 50;
  else if (firstDesign.layout) score += 30; // any layout is okay

  // Typography should match tone.
  if (plan.tone === "provocative" && firstDesign.typography === "headline") score += 50;
  else if (plan.tone === "analytical" && firstDesign.typography === "stat") score += 50;
  else score += 30;

  return score;
}
