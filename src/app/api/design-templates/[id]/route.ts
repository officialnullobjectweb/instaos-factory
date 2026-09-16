import { NextResponse } from "next/server";

import { savedDesignTemplateInputSchema } from "@/design/api-schemas";
import {
  deleteDesignTemplate,
  getDesignTemplate,
  updateDesignTemplate,
} from "@/lib/repositories/design-templates-repository";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const template = await getDesignTemplate(id);
  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }
  return NextResponse.json({ template });
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = savedDesignTemplateInputSchema.partial().safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid template patch",
        detail: parsed.error.issues
          .map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`)
          .join("; "),
      },
      { status: 400 },
    );
  }

  const template = await updateDesignTemplate(id, parsed.data);
  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }
  return NextResponse.json({ template });
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  const removed = await deleteDesignTemplate(id);
  if (!removed) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
