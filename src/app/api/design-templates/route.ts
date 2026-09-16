import { NextResponse } from "next/server";

import { savedDesignTemplateInputSchema } from "@/design/api-schemas";
import {
  createDesignTemplate,
  listDesignTemplates,
} from "@/lib/repositories/design-templates-repository";

export const dynamic = "force-dynamic";

/** GET /api/design-templates — every saved studio preset. */
export async function GET() {
  const templates = await listDesignTemplates();
  return NextResponse.json({ templates });
}

/** POST /api/design-templates — save the current document as a reusable preset. */
export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = savedDesignTemplateInputSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid template",
        detail: parsed.error.issues
          .map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`)
          .join("; "),
      },
      { status: 400 },
    );
  }

  const template = await createDesignTemplate(parsed.data);
  return NextResponse.json({ template }, { status: 201 });
}
