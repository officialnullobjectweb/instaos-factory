import { wrapLines } from "@/design/fit";
import {
  ADJUSTMENT_LIMITS,
  DEFAULT_ADJUSTMENTS,
  SLIDE_HEIGHT,
  SLIDE_WIDTH,
  type ResolvedTemplate,
  type SlideAdjustments,
  type SlideSpec,
  type TextAlign,
  type VerticalAnchor,
} from "@/design/types";

/**
 * The slide composer.
 *
 * Text on a slide is a single block with one internal rhythm: kicker, headline,
 * body, stat. This module decides where that block sits and exactly which
 * baseline every line lands on, and the renderer, the fit engine, the quality
 * report and the editor's guides all read those numbers.
 *
 * Before this existed the kicker was pinned to the top margin while the
 * headline was bottom-anchored, which is what produced the dead gap in the
 * middle of a cover and the collisions between a motif band and long copy.
 * One geometry, one source of truth.
 */

const KICKER_SIZE = 24;
const KICKER_LINE_HEIGHT = 1.4;
const GAP_KICKER = 30;
const GAP_BODY = 34;
const GAP_STAT = 36;
/** Distance from the bottom margin up to the footer rule. */
const FOOTER_RULE_INSET = 34;
/** Clear space between the text block's floor and the footer rule. */
const FOOTER_GAP = 44;
const MOTIF_BASE_HEIGHT = 300;
const MOTIF_MIN_HEIGHT = 170;
const MOTIF_MAX_HEIGHT = 560;
const MOTIF_GAP = 56;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/** Clamps a stored document's adjustments into the supported ranges. */
export function resolveAdjustments(adjust?: SlideAdjustments): {
  align: TextAlign;
  vertical: VerticalAnchor;
  offsetX: number;
  offsetY: number;
  scale: number;
  motifScale: number;
} {
  return {
    align: adjust?.align ?? DEFAULT_ADJUSTMENTS.align,
    vertical: adjust?.vertical ?? DEFAULT_ADJUSTMENTS.vertical,
    offsetX: clamp(
      adjust?.offsetX ?? 0,
      -ADJUSTMENT_LIMITS.offsetX,
      ADJUSTMENT_LIMITS.offsetX,
    ),
    offsetY: clamp(
      adjust?.offsetY ?? 0,
      -ADJUSTMENT_LIMITS.offsetY,
      ADJUSTMENT_LIMITS.offsetY,
    ),
    scale: clamp(
      adjust?.scale ?? 1,
      ADJUSTMENT_LIMITS.scale.min,
      ADJUSTMENT_LIMITS.scale.max,
    ),
    motifScale: clamp(
      adjust?.motifScale ?? 1,
      ADJUSTMENT_LIMITS.motifScale.min,
      ADJUSTMENT_LIMITS.motifScale.max,
    ),
  };
}

/** True when the slide will draw something in the motif band. */
export function hasMotif(slide: SlideSpec): boolean {
  const motif = slide.motif ?? "none";
  if (motif === "none") return false;
  if (motif === "map") return true;
  return Boolean(slide.assetRef);
}

export interface ComposedSlide {
  /** Effective per-slide type scale, already clamped. */
  typeScale: number;
  align: TextAlign;
  vertical: VerticalAnchor;
  /** `start` / `middle` / `end` — the SVG text-anchor for the block. */
  textAnchor: string;
  /** X for the block, before the horizontal nudge. */
  blockX: number;
  /** Nudges, already clamped. */
  offsetX: number;
  offsetY: number;

  kickerSize: number;
  bodySize: number;
  displaySize: number;

  kickerLines: string[];
  displayLines: string[];
  bodyLines: string[];

  /** Baseline of the first kicker line. */
  kickerBaseline: number;
  /** Baselines of every headline line, in order. */
  displayBaselines: number[];
  /** Baselines of every body line, in order. */
  bodyBaselines: number[];
  stat: { value: string; label: string; valueBaseline: number; labelBaseline: number } | null;

  /** Safe area. */
  contentTop: number;
  contentBottom: number;
  /** Height of the motif band (0 when there is none). */
  motifHeight: number;
  motifTop: number;

  /** Box of the composed text block — used for guides and overflow checks. */
  blockTop: number;
  blockHeight: number;
  blockBottom: number;

  /** True when the block needs more room than the slide can give it. */
  overflow: boolean;
}

/**
 * Lays out one slide for a given display size.
 *
 * Pure arithmetic on the template's metrics — no measurement of real glyphs, so
 * server and client agree line for line.
 */
export function composeSlide(
  slide: SlideSpec,
  template: ResolvedTemplate,
  displaySize: number,
): ComposedSlide {
  const { typography, spacing } = template;
  const adjust = resolveAdjustments(slide.adjust);

  const margin = spacing.margin;
  const contentWidth = SLIDE_WIDTH - margin * 2;

  const typeScale = adjust.scale;
  const kickerSize = KICKER_SIZE * typeScale;
  const bodySize = typography.bodySize * typeScale;

  const displayFamily = typography.display;
  const bodyFamily = typography.body;

  const kickerLines = wrapLines(slide.kicker, kickerSize, contentWidth, bodyFamily);
  const displayLines = wrapLines(
    slide.headline,
    displaySize,
    contentWidth,
    displayFamily,
  );
  const bodyLines = wrapLines(slide.body, bodySize, contentWidth, bodyFamily);

  /* ---------------------------- vertical extent ---------------------------- */

  const contentTop = margin;
  const footerRuleY = SLIDE_HEIGHT - margin - FOOTER_RULE_INSET;
  const contentBottom = footerRuleY - FOOTER_GAP;

  const motifHeight = hasMotif(slide)
    ? clamp(
        MOTIF_BASE_HEIGHT * adjust.motifScale,
        MOTIF_MIN_HEIGHT,
        MOTIF_MAX_HEIGHT,
      )
    : 0;
  const motifTop = contentTop;
  const textTop = contentTop + (motifHeight > 0 ? motifHeight + MOTIF_GAP : 0);

  /* ------------------------------ block height ----------------------------- */

  const kickerHeight = kickerLines.length * kickerSize * KICKER_LINE_HEIGHT;
  const gapAfterKicker = kickerLines.length > 0 ? GAP_KICKER * typeScale : 0;
  const displayHeight = displayLines.length * displaySize * typography.lineHeightDisplay;
  const gapAfterDisplay = bodyLines.length > 0 ? GAP_BODY * typeScale : 0;
  const bodyHeight = bodyLines.length * bodySize * typography.lineHeightBody;

  const statValueSize = bodySize * 3.2;
  const statHeight = slide.stat
    ? statValueSize * 1.15 + bodySize * 1.7 + GAP_STAT * typeScale
    : 0;

  const blockHeight =
    kickerHeight + gapAfterKicker + displayHeight + gapAfterDisplay + bodyHeight + statHeight;

  const availableHeight = Math.max(0, contentBottom - textTop);
  const overflow = blockHeight > availableHeight + 1;

  /* ------------------------------- anchoring ------------------------------- */

  let blockTop =
    adjust.vertical === "top"
      ? textTop
      : adjust.vertical === "middle"
        ? textTop + Math.max(0, (availableHeight - blockHeight) / 2)
        : contentBottom - blockHeight;

  // Bottom and middle anchoring give way to the motif rather than overlapping
  // it: a block taller than its band is pushed down, never up into the artwork.
  // An explicit vertical nudge may still overlap the motif — that is the user
  // asking for it — but it can never leave the slide.
  blockTop = Math.max(contentTop, Math.max(textTop, blockTop) + adjust.offsetY);

  const blockX =
    adjust.align === "center"
      ? SLIDE_WIDTH / 2
      : adjust.align === "right"
        ? SLIDE_WIDTH - margin
        : margin;

  const textAnchor =
    adjust.align === "center" ? "middle" : adjust.align === "right" ? "end" : "start";

  /* -------------------------------- baselines ------------------------------ */

  const kickerBaseline = blockTop + kickerSize * 0.8;
  const displayTop = blockTop + kickerHeight + gapAfterKicker;
  const displayBaselines = displayLines.map(
    (_, index) =>
      displayTop + displaySize * 0.82 + index * displaySize * typography.lineHeightDisplay,
  );
  const bodyTop = displayTop + displayHeight + gapAfterDisplay;
  const bodyBaselines = bodyLines.map(
    (_, index) => bodyTop + bodySize * 0.82 + index * bodySize * typography.lineHeightBody,
  );

  const stat = slide.stat
    ? (() => {
        const statTop = bodyTop + bodyHeight;
        const valueBaseline = statTop + statValueSize * 0.85;
        return {
          value: slide.stat.value,
          label: slide.stat.label,
          valueBaseline,
          labelBaseline: valueBaseline + bodySize * 1.7,
        };
      })()
    : null;

  return {
    typeScale,
    align: adjust.align,
    vertical: adjust.vertical,
    textAnchor,
    blockX,
    offsetX: adjust.offsetX,
    offsetY: adjust.offsetY,
    kickerSize,
    bodySize,
    displaySize,
    kickerLines,
    displayLines,
    bodyLines,
    kickerBaseline,
    displayBaselines,
    bodyBaselines,
    stat,
    contentTop,
    contentBottom,
    motifHeight,
    motifTop,
    blockTop,
    blockHeight,
    blockBottom: blockTop + blockHeight,
    overflow,
  };
}

/** Baseline of the footer rule and the footer’s own text. */
export function footerGeometry(template: ResolvedTemplate) {
  const ruleY = SLIDE_HEIGHT - template.spacing.margin - FOOTER_RULE_INSET;
  return { ruleY, textY: ruleY + 34 };
}

export { MOTIF_GAP, FOOTER_GAP };
