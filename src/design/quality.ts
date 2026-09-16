import {
  SLIDE_HEIGHT,
  SLIDE_WIDTH,
  type ContrastPair,
  type QualityReport,
  type ResolvedTemplate,
  type SlideQualityIssue,
  type SlideSpec,
} from "@/design/types";

/**
 * Quality rules for the carousel engine.
 *
 * These are hard constraints, not suggestions: a deck that fails them is marked
 * failed and the UI says exactly which slide and why. Word limits and safe
 * margins are enforced at compose time; contrast and auto-fit are measured
 * against the resolved template so an override that breaks accessibility is
 * caught before anything is exported.
 */

export const MAX_WORDS_PER_SLIDE = 45;

/** WCAG contrast thresholds. Display type qualifies as large text. */
const CONTRAST_NORMAL = 4.5;
const CONTRAST_LARGE = 3.0;

/* ------------------------------ colour maths ------------------------------ */

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace("#", "");
  const full =
    value.length === 3
      ? value
          .split("")
          .map((char) => char + char)
          .join("")
      : value;
  const int = Number.parseInt(full, 16);
  if (Number.isNaN(int)) return [0, 0, 0];
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}

function channel(value: number) {
  const normalised = value / 255;
  return normalised <= 0.03928
    ? normalised / 12.92
    : ((normalised + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string) {
  const [r, g, b] = hexToRgb(hex).map(channel);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string) {
  const la = luminance(a);
  const lb = luminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

/* -------------------------------- words ----------------------------------- */

export function countWords(text: string) {
  const trimmed = text.trim();
  if (trimmed === "") return 0;
  return trimmed.split(/\s+/).length;
}

export function wordsPerSlide(slide: SlideSpec) {
  return (
    countWords(slide.kicker) +
    countWords(slide.headline) +
    countWords(slide.body) +
    countWords(slide.footnote ?? "") +
    countWords(slide.stat ? `${slide.stat.value} ${slide.stat.label}` : "")
  );
}

/* ------------------------------ safe margins ------------------------------ */

export function isWithinSafeArea(slide: SlideSpec) {
  // Text lives in the layout, so this checks the composed text length only —
  // the renderer clips at the margin edge and reports the real boxes.
  return wordsPerSlide(slide) <= MAX_WORDS_PER_SLIDE;
}

/* -------------------------------- report ---------------------------------- */

export function contrastPairs(template: ResolvedTemplate): ContrastPair[] {
  const { palette } = template;
  return [
    {
      name: "Ink on background",
      ratio: contrastRatio(palette.ink, palette.background),
      passes: contrastRatio(palette.ink, palette.background) >= CONTRAST_NORMAL,
      largeText: false,
    },
    {
      name: "Soft ink on background",
      ratio: contrastRatio(palette.inkSoft, palette.background),
      passes: contrastRatio(palette.inkSoft, palette.background) >= CONTRAST_NORMAL,
      largeText: false,
    },
    {
      name: "Accent on background",
      ratio: contrastRatio(palette.accent, palette.background),
      passes: contrastRatio(palette.accent, palette.background) >= CONTRAST_LARGE,
      largeText: true,
    },
    {
      name: "On-accent on accent",
      ratio: contrastRatio(palette.onAccent, palette.accent),
      passes: contrastRatio(palette.onAccent, palette.accent) >= CONTRAST_LARGE,
      largeText: true,
    },
    {
      name: "Ink on surface",
      ratio: contrastRatio(palette.ink, palette.surface),
      passes: contrastRatio(palette.ink, palette.surface) >= CONTRAST_NORMAL,
      largeText: false,
    },
  ];
}

export function evaluateDeck(
  slides: SlideSpec[],
  template: ResolvedTemplate,
  autoFitScale: Array<{ slideIndex: number; scale: number; overflow?: boolean }>,
): QualityReport {
  const issues: SlideQualityIssue[] = [];
  const words = slides.map((slide) => wordsPerSlide(slide));

  slides.forEach((slide, index) => {
    const slideNo = index + 1;
    if (words[index] > MAX_WORDS_PER_SLIDE) {
      issues.push({
        slideIndex: slideNo,
        severity: "error",
        message: `${words[index]} words — the limit is ${MAX_WORDS_PER_SLIDE}. Cut the body before exporting.`,
      });
    }
    if (slide.headline.trim() === "") {
      issues.push({
        slideIndex: slideNo,
        severity: "error",
        message: "Headline is empty.",
      });
    }
    if (slide.motif && slide.motif !== "none" && !slide.assetRef && slide.motif !== "map") {
      issues.push({
        slideIndex: slideNo,
        severity: "warning",
        message: `Motif “${slide.motif}” has no asset selected.`,
      });
    }
    if (slide.body.length > 0 && slide.body.length < 24 && slide.layout !== "closing") {
      issues.push({
        slideIndex: slideNo,
        severity: "warning",
        message: "Body copy is very short for this layout.",
      });
    }
  });

  // Real overflow, measured by the composer at the final size. This is the
  // check that actually protects the export: word counts are a proxy, this is
  // the box colliding with the footer rule.
  for (const entry of autoFitScale) {
    if (entry.overflow) {
      issues.push({
        slideIndex: entry.slideIndex + 1,
        severity: "error",
        message:
          "Copy does not fit the safe area — it reaches past the footer. Trim the body or lower the slide's type scale.",
      });
    }
  }

  const fitIssue = autoFitScale.find((entry) => entry.scale < 0.6);
  if (fitIssue) {
    issues.push({
      slideIndex: fitIssue.slideIndex + 1,
      severity: "warning",
      message: `Text had to shrink to ${Math.round(fitIssue.scale * 100)}% — consider trimming copy.`,
    });
  }

  const contrast = contrastPairs(template);
  for (const pair of contrast) {
    if (!pair.passes) {
      issues.push({
        slideIndex: 0,
        severity: "error",
        message: `Contrast fails: ${pair.name} is ${pair.ratio.toFixed(2)}:1.`,
      });
    }
  }

  const overflow = issues.some(
    (issue) => issue.severity === "error" && issue.slideIndex > 0,
  );

  return {
    wordsPerSlide: words,
    maxWords: MAX_WORDS_PER_SLIDE,
    overflow,
    issues,
    contrast,
    autoFitScale,
    passed: issues.every((issue) => issue.severity !== "error"),
  };
}

export { SLIDE_HEIGHT, SLIDE_WIDTH };
