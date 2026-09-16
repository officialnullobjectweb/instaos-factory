import { z } from "zod";

/**
 * Schemas for design documents crossing the API boundary.
 *
 * The editor holds a looser in-memory shape; anything sent to the render or
 * template endpoints must validate here first — an invalid palette or an
 * out-of-range size must fail the request, not produce a broken PNG.
 */

export const templatePaletteSchema = z.object({
  background: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  surface: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  ink: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  inkSoft: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  onAccent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

export const templateTypographySchema = z.object({
  display: z.enum(["inter", "fraunces", "grotesk"]),
  body: z.enum(["inter", "fraunces", "grotesk"]),
  displaySizeMax: z.number().min(40).max(140),
  displaySizeMin: z.number().min(28).max(120),
  bodySize: z.number().min(20).max(48),
  lineHeightDisplay: z.number().min(0.9).max(1.6),
  lineHeightBody: z.number().min(1.1).max(2.2),
  letterSpacingDisplay: z.number().min(-0.08).max(0.08),
  uppercaseKicker: z.boolean(),
});

export const templateSpacingSchema = z.object({
  margin: z.number().min(40).max(160),
  gutter: z.number().min(12).max(80),
  baseline: z.number().min(4).max(16),
});

/** Per-slide alignment and positioning nudges, bounded to the engine's limits. */
export const slideAdjustmentsSchema = z.object({
  align: z.enum(["left", "center", "right"]).optional(),
  vertical: z.enum(["top", "middle", "bottom"]).optional(),
  offsetX: z.number().min(-120).max(120).optional(),
  offsetY: z.number().min(-220).max(220).optional(),
  scale: z.number().min(0.7).max(1.3).optional(),
  motifScale: z.number().min(0.5).max(1.6).optional(),
});

export const slideSpecSchema = z.object({
  index: z.number().int().min(1).max(7),
  layout: z.enum(["cover", "statement", "data", "closing"]),
  kicker: z.string().max(80),
  headline: z.string().max(160),
  body: z.string().max(600).default(""),
  footnote: z.string().max(160).optional(),
  motif: z
    .enum(["none", "map", "icon", "pattern", "illustration", "flag"])
    .optional()
    .default("none"),
  assetRef: z.string().max(60).optional(),
  highlightCountries: z.array(z.string().max(40)).max(8).optional(),
  stat: z
    .object({
      value: z.string().max(12),
      label: z.string().max(60),
    })
    .optional(),
  adjust: slideAdjustmentsSchema.optional(),
});

export const designOverridesSchema = z.object({
  palette: templatePaletteSchema.partial().optional(),
  typography: templateTypographySchema.partial().optional(),
  spacing: templateSpacingSchema.partial().optional(),
  footer: z.string().max(60).optional(),
});

export const designDocumentSchema = z.object({
  templateId: z.enum(["geography", "psychology", "branding"]),
  overrides: designOverridesSchema,
  slides: z.array(slideSpecSchema).min(1).max(7),
});

export const savedDesignTemplateInputSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(200).default(""),
  document: designDocumentSchema,
});
