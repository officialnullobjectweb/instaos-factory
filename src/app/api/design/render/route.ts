import { NextResponse } from "next/server";
import { z } from "zod";

import { slideSpecSchema, designOverridesSchema } from "@/design/api-schemas";
import { fitDeck } from "@/design/fit";
import { evaluateDeck } from "@/design/quality";
import { exportPdf, exportPngZip, renderSlidePng } from "@/design/server/export";
import { resolveTemplate } from "@/design/templates";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const bodySchema = z.object({
  templateId: z.enum(["geography", "psychology", "branding"]),
  overrides: designOverridesSchema.optional().default({}),
  slides: z.array(slideSpecSchema).min(1).max(7),
  format: z.enum(["png", "pdf", "zip"]).default("png"),
  /** For single-PNG exports: which slide, 1-based. */
  slideIndex: z.number().int().min(1).max(7).optional(),
  /** Bypasses the quality gate. Deliberate, auditable escape hatch. */
  force: z.boolean().optional().default(false),
});

/**
 * POST /api/design/render — export slides.
 *
 * `png` returns one image (slideIndex) or the first slide; `pdf` one file with
 * a page per slide; `zip` one archive with numbered PNGs. Everything renders
 * server-side from the same SVG the editor previews, so what you approve is
 * exactly what ships.
 *
 * The quality gate runs here, not only in the UI: an exported file must never
 * be one the rules would have rejected. A caller that genuinely needs an
 * out-of-spec export can pass `force: true` and owns the result.
 */
export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid design document",
        detail: parsed.error.issues
          .map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`)
          .join("; "),
      },
      { status: 400 },
    );
  }

  const { templateId, overrides, slides, format, slideIndex, force } = parsed.data;
  const template = resolveTemplate(templateId, overrides);
  const normalised = slides.map((slide, index) => ({ ...slide, index: index + 1 }));

  if (!force) {
    const report = evaluateDeck(normalised, template, fitDeck(normalised, template));
    if (!report.passed) {
      const blocking = report.issues.filter((issue) => issue.severity === "error");
      return NextResponse.json(
        {
          error: "Quality gate blocked this export",
          detail: blocking
            .map(
              (issue) =>
                `${issue.slideIndex === 0 ? "Deck" : `Slide ${issue.slideIndex}`}: ${issue.message}`,
            )
            .join(" "),
          issues: blocking,
        },
        { status: 422 },
      );
    }
  }

  try {
    if (format === "png") {
      const target =
        normalised.find((slide) => slide.index === slideIndex) ?? normalised[0];
      const png = renderSlidePng(target, template);
      return new NextResponse(new Uint8Array(png), {
        headers: {
          "Content-Type": "image/png",
          "Content-Disposition": `inline; filename="slide-${String(target.index).padStart(2, "0")}.png"`,
          "Cache-Control": "no-store",
        },
      });
    }

    if (format === "pdf") {
      const pdf = await exportPdf(normalised, template);
      return new NextResponse(new Uint8Array(pdf), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="carousel-${templateId}.pdf"`,
          "Cache-Control": "no-store",
        },
      });
    }

    const zip = await exportPngZip(normalised, template);
    return new NextResponse(new Uint8Array(zip), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="carousel-${templateId}-slides.zip"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Render failed",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
