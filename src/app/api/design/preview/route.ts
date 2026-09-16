import { NextResponse } from "next/server";

import { slideSpecSchema, designOverridesSchema } from "@/design/api-schemas";
import { renderSlideSvg } from "@/design/server/render";
import { resolveTemplate } from "@/design/templates";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  templateId: z.enum(["geography", "psychology", "branding"]),
  overrides: designOverridesSchema.optional().default({}),
  slide: slideSpecSchema,
});

/**
 * POST /api/design/preview — one slide as raw SVG.
 *
 * The editor's live preview needs the *exact* renderer output without paying
 * for a PNG rasterisation on every keystroke. Returning `image/svg+xml` means
 * the browser renders the same vector the exporter sees, and the response is
 * cache-bustable with no-store. Fonts resolve because the SVG embeds the same
 * base64 @font-face block the rasteriser uses.
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
        error: "Invalid preview request",
        detail: parsed.error.issues
          .map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`)
          .join("; "),
      },
      { status: 400 },
    );
  }

  const { templateId, overrides, slide } = parsed.data;
  const template = resolveTemplate(templateId, overrides);
  const svg = renderSlideSvg({ ...slide, index: slide.index ?? 1 }, template);

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "no-store",
    },
  });
}
