import { Resvg } from "@resvg/resvg-js";
import { PDFDocument, rgb } from "pdf-lib";
import JSZip from "jszip";

import { designAssets } from "@/design/server/assets";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";

/**
 * resvg loads fonts from file paths, so the bundled woff2 buffers are
 * materialised to a temp dir once per process.
 */
const fontPathCache = new Map<string, string>();

function fontFilePaths(): string[] {
  return designAssets().fonts.map((font) => {
    const cached = fontPathCache.get(font.name);
    if (cached) return cached;

    const file = path.join(tmpdir(), `factory-${font.name}-${randomUUID().slice(0, 8)}.woff2`);
    writeFileSync(file, font.data);
    fontPathCache.set(font.name, file);
    return file;
  });
}
import { fontFaceCss, renderSlideSvg } from "@/design/server/render";
import { resolveTemplate } from "@/design/templates";
import {
  SLIDE_HEIGHT,
  SLIDE_WIDTH,
  type DesignDocument,
  type ResolvedTemplate,
  type SlideSpec,
} from "@/design/types";

/**
 * The export pipeline.
 *
 * Slides are SVG (HTML-free by design: SVG text layout is deterministic, needs
 * no browser, and rasterises identically on any machine). PNG via resvg with
 * the self-hosted font set, PDF via pdf-lib (one page per slide), ZIP via
 * JSZip. Nothing here talks to the network.
 */

function svgWithFonts(svg: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
<style>${fontFaceCss()}</style>
${svg.replace(/<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "")}
</svg>`;
}

function rasterise(svg: string): Buffer {
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: SLIDE_WIDTH },
    font: {
    // resvg's fontFiles takes file paths; point it at the materialised TTFs
    // (converted from the woff2 sources by scripts/build-fonts.mjs — resvg's
    // fontdb cannot parse woff2 and would silently drop every glyph).
    fontFiles: fontFilePaths(),
      loadSystemFonts: false,
      defaultFontFamily: "Inter",
    },
  });
  return Buffer.from(resvg.render().asPng());
}

export function renderSlidePng(slide: SlideSpec, template: ResolvedTemplate): Buffer {
  return rasterise(svgWithFonts(renderSlideSvg(slide, template)));
}

export function exportPngZip(
  slides: SlideSpec[],
  template: ResolvedTemplate,
): Promise<Buffer> {
  const zip = new JSZip();
  slides.forEach((slide) => {
    zip.file(
      `slide-${String(slide.index).padStart(2, "0")}.png`,
      renderSlidePng(slide, template),
    );
  });
  return zip.generateAsync({ type: "nodebuffer" }) as unknown as Promise<Buffer>;
}

export async function exportPdf(
  slides: SlideSpec[],
  template: ResolvedTemplate,
): Promise<Buffer> {
  const pdf = await PDFDocument.create();

  for (const slide of slides) {
    const png = renderSlidePng(slide, template);
    const image = await pdf.embedPng(png);
    const page = pdf.addPage([SLIDE_WIDTH, SLIDE_HEIGHT]);
    page.drawImage(image, {
      x: 0,
      y: 0,
      width: SLIDE_WIDTH,
      height: SLIDE_HEIGHT,
    });
    // A hairline crop frame so the deck reads as pages, not screenshots.
    page.drawRectangle({
      x: 0.5,
      y: 0.5,
      width: SLIDE_WIDTH - 1,
      height: SLIDE_HEIGHT - 1,
      borderColor: rgb(0.9, 0.9, 0.88),
      borderWidth: 1,
    });
  }

  const bytes = await pdf.save();
  return Buffer.from(bytes);
}

export function renderDocumentPng(document_: DesignDocument): Buffer[] {
  const template = resolveTemplate(document_.templateId, document_.overrides);
  return document_.slides.map((slide) => renderSlidePng(slide, template));
}

/** Kept for callers that want the raw SVG (e.g. editor inline previews). */
export function documentSvgs(document_: DesignDocument): string[] {
  const template = resolveTemplate(document_.templateId, document_.overrides);
  return document_.slides.map((slide) => renderSlideSvg(slide, template));
}

export { designAssets };
