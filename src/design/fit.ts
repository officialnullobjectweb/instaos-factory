import { composeSlide, resolveAdjustments } from "@/design/compose";
import type { ResolvedTemplate, SlideSpec } from "@/design/types";
import { countWords } from "@/design/quality";

/**
 * The auto-fit engine.
 *
 * The renderer works in SVG, where nothing reflows — so the fit must be
 * computed, not hoped for. This module implements the same greedy line-wrap the
 * renderer uses, estimates line heights from the template's metrics, and shrinks
 * the display size step by step until the composed text block fits the safe
 * area. The client uses it to report fit quality; the server uses it to lay out
 * the actual render.
 *
 * Character-width estimates are generous (slightly wider than the real fonts),
 * so the fit is conservative: a slide that passes here will not overflow in the
 * PNG.
 */

/** Rough per-character advance widths, as a fraction of font size. */
const WIDTH_FACTORS: Record<string, number> = {
  inter: 0.52,
  grotesk: 0.56,
  fraunces: 0.5,
};

function widthFactor(family: string) {
  return WIDTH_FACTORS[family] ?? 0.54;
}

/**
 * Greedy wrap.
 *
 * This is the *only* line-breaking implementation in the engine: the composer
 * renders these exact strings, the fit engine measures their count and the
 * editor counts characters the same way. Three implementations would mean the
 * preview, the export and the quality report could disagree about a line count.
 */
export function wrapLines(
  text: string | null | undefined,
  fontSize: number,
  maxWidth: number,
  family: string,
): string[] {
  // Tolerant on purpose: a document that reaches the renderer missing a field
  // must draw an empty line, not take down an export.
  if (typeof text !== "string" || text.trim() === "") return [];
  const factor = widthFactor(family);
  const charWidth = fontSize * factor;
  const maxChars = Math.max(8, Math.floor(maxWidth / charWidth));

  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }
    let current = words[0];
    for (const word of words.slice(1)) {
      if (current.length + 1 + word.length > maxChars) {
        lines.push(current);
        current = word;
      } else {
        current = `${current} ${word}`;
      }
    }
    lines.push(current);
  }
  return lines;
}

/** Number of visual lines a string needs — a thin wrapper over `wrapLines`. */
export function estimateLines(
  text: string | null | undefined,
  fontSize: number,
  maxWidth: number,
  family: string,
): number {
  return wrapLines(text, fontSize, maxWidth, family).length;
}

export interface FitResult {
  /** Final display size after auto-fit. */
  displaySize: number;
  /** displaySize / typography.displaySizeMax — the quality signal. */
  scale: number;
  fits: boolean;
}

/**
 * Shrink-to-fit for a slide's composed text block.
 *
 * The fit is measured with the *same* composer that draws the slide: a size is
 * acceptable only when that geometry reports no overflow. The previous version
 * used a separate approximation of the vertical budget, so a slide could pass
 * the quality gate and still collide with its own footer in the PNG.
 */
export function fitSlide(
  slide: SlideSpec,
  template: ResolvedTemplate,
): FitResult {
  const { typography } = template;
  const { scale: typeScale } = resolveAdjustments(slide.adjust);

  let size = typography.displaySizeMax * typeScale;
  const min = typography.displaySizeMin * typeScale;

  const fits = (candidate: number) => !composeSlide(slide, template, candidate).overflow;

  while (size > min && !fits(size)) {
    size -= 2;
  }

  return {
    displaySize: size,
    scale: size / typography.displaySizeMax,
    fits: fits(size),
  };
}

export interface DeckFitEntry {
  slideIndex: number;
  scale: number;
  displaySize: number;
  /** True when the composed block still needs more room than the slide has. */
  overflow: boolean;
}

/**
 * Fit every slide of a deck.
 *
 * The overflow flag comes from the composer at the final size, so the quality
 * report can say "this collides with the footer" rather than inferring a
 * problem from a word count.
 */
export function fitDeck(
  slides: SlideSpec[],
  template: ResolvedTemplate,
): DeckFitEntry[] {
  return slides.map((slide, index) => {
    const fit = fitSlide(slide, template);
    const composed = composeSlide(slide, template, fit.displaySize);
    return {
      slideIndex: index,
      scale: fit.scale,
      displaySize: fit.displaySize,
      overflow: composed.overflow,
    };
  });
}

/** The renderer's number: words a slide will actually draw. */
export function slideWordCount(slide: SlideSpec) {
  return (
    countWords(slide.kicker) +
    countWords(slide.headline) +
    countWords(slide.body) +
    countWords(slide.footnote ?? "")
  );
}
