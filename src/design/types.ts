/* -------------------------------------------------------------------------- */
/*  Design engine — shared with client and server                             */
/* -------------------------------------------------------------------------- */

export const SLIDE_WIDTH = 1080;
export const SLIDE_HEIGHT = 1350;
export const SLIDE_COUNT = 7;

/* -------------------------------- Templates ------------------------------- */

export type TemplateId = "geography" | "psychology" | "branding";

export interface WorldFeatureCollection {
  countries: unknown;
  land: unknown;
}

export interface GeoJsonCollection {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    properties: Record<string, unknown>;
    geometry:
      | { type: "Polygon"; coordinates: number[][][] }
      | { type: "MultiPolygon"; coordinates: number[][][][] };
  }>;
}

/** The three slide layouts a template can arrange its content into. */
export type SlideLayout = "cover" | "statement" | "data" | "closing";

export interface TemplatePalette {
  background: string;
  surface: string;
  ink: string;
  inkSoft: string;
  accent: string;
  onAccent: string;
}

export interface TemplateTypography {
  /** Font family id — resolved to a self-hosted file at render time. */
  display: "inter" | "fraunces" | "grotesk";
  body: "inter" | "fraunces" | "grotesk";
  /** Display sizes at 1080×1350; the auto-fit engine scales within these. */
  displaySizeMax: number;
  displaySizeMin: number;
  bodySize: number;
  lineHeightDisplay: number;
  lineHeightBody: number;
  letterSpacingDisplay: number;
  uppercaseKicker: boolean;
}

export interface TemplateSpacing {
  /** Safe margin — nothing renders outside it. */
  margin: number;
  gutter: number;
  baseline: number;
}

export type SlideMotif = "none" | "map" | "icon" | "pattern" | "illustration" | "flag";

/* --------------------------- per-slide adjustment -------------------------- */

export type TextAlign = "left" | "center" | "right";
export type VerticalAnchor = "top" | "middle" | "bottom";

/**
 * Per-slide alignment and positioning.
 *
 * Everything here is a *nudge*, not a redesign: the composed block keeps its
 * internal rhythm and the template keeps owning the palette and type scale.
 * The values are clamped by both the composer and the editor so a saved
 * document can never render something a human could not have set.
 */
export interface SlideAdjustments {
  /** Horizontal alignment of the whole text block. */
  align?: TextAlign;
  /** Where the block sits in the space left under the motif band. */
  vertical?: VerticalAnchor;
  /** Horizontal nudge, in slide pixels. */
  offsetX?: number;
  /** Vertical nudge, in slide pixels. */
  offsetY?: number;
  /** Per-slide type scale — the headline and body move together. */
  scale?: number;
  /** Per-slide motif size; also resizes the band it reserves. */
  motifScale?: number;
}

/**
 * Shared bounds. The renderer clamps to these and the editor's controls are
 * built from them, so the UI can never offer a value the engine will reject.
 */
export const ADJUSTMENT_LIMITS = {
  offsetX: 120,
  offsetY: 220,
  scale: { min: 0.7, max: 1.3, step: 0.02 },
  motifScale: { min: 0.5, max: 1.6, step: 0.05 },
} as const;

export const DEFAULT_ADJUSTMENTS: Required<SlideAdjustments> = {
  align: "left",
  vertical: "bottom",
  offsetX: 0,
  offsetY: 0,
  scale: 1,
  motifScale: 1,
};

export interface SlideSpec {
  /** Deck position, 1-based. The renderer uses this for numbering. */
  index: number;
  layout: SlideLayout;
  kicker: string;
  headline: string;
  body: string;
  footnote?: string;
  /** Which background motif the template should draw, if any. */
  motif?: SlideMotif;
  /** Asset reference for the motif, e.g. "icon:wave" or "flag:jp". */
  assetRef?: string;
  /** For map motifs: ISO codes or names to highlight. */
  highlightCountries?: string[];
  /** A single supporting statistic, drawn big in the data layout. */
  stat?: { value: string; label: string };
  /** Alignment and positioning nudges for this slide. */
  adjust?: SlideAdjustments;
}

export interface TemplateTokens {
  id: TemplateId;
  label: string;
  description: string;
  palette: TemplatePalette;
  typography: TemplateTypography;
  spacing: TemplateSpacing;
  /** Footer branding line drawn on every slide. */
  footer: string;
}

export interface DesignOverrides {
  palette?: Partial<TemplatePalette>;
  typography?: Partial<TemplateTypography>;
  spacing?: Partial<TemplateSpacing>;
  footer?: string;
}

export interface DesignDocument {
  templateId: TemplateId;
  overrides: DesignOverrides;
  slides: SlideSpec[];
}

export type ResolvedTemplate = TemplateTokens & { overrides: DesignOverrides };

/* ---------------------------- Asset library ------------------------------- */

export interface AssetEntry {
  id: string;
  label: string;
  tags: string[];
  viewBox: string;
  paths: string[];
  /** Flags carry explicit fills (their colours are part of the reference). */
  fills?: string[];
}

export interface AssetLibrary {
  icons: AssetEntry[];
  illustrations: AssetEntry[];
  patterns: AssetEntry[];
  flags: AssetEntry[];
}

/* ------------------------------- Quality --------------------------------- */

export interface SlideQualityIssue {
  slideIndex: number;
  severity: "error" | "warning";
  message: string;
}

export interface ContrastPair {
  name: string;
  ratio: number;
  passes: boolean;
  /** WCAG large-text threshold (3:1) — display type qualifies. */
  largeText: boolean;
}

export interface QualityReport {
  wordsPerSlide: number[];
  maxWords: number;
  overflow: boolean;
  issues: SlideQualityIssue[];
  contrast: ContrastPair[];
  autoFitScale: Array<{ slideIndex: number; scale: number }>;
  passed: boolean;
}

/* ------------------------------ Sub-niches -------------------------------- */

export type MainNiche = "geography" | "psychology" | "branding";

export interface AudienceProfile {
  id: string;
  label: string;
  ageRange: string;
  interests: string[];
  painPoint: string;
  demandSignal: string;
  sizeEstimate: string;
}

export interface DesignVariant {
  id: string;
  label: string;
  /** What this variant assumes about the audience, and how the design answers it. */
  thesis: string;
  templateId: TemplateId;
  overrides: DesignOverrides;
  /** Distinct content angle used when composing posts for this variant. */
  contentAngle: string;
}

export interface SubNiche {
  id: string;
  mainNiche: MainNiche;
  label: string;
  /** Why this sub-niche: pain point or proven demand. */
  rationale: string;
  audiences: AudienceProfile[];
  variants: [DesignVariant, DesignVariant];
}
