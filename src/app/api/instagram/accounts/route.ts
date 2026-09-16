import { NextResponse } from "next/server";

import {
  listAccounts,
  toPublic,
  upsertAccount,
} from "@/lib/repositories/instagram-accounts-repository";

export const dynamic = "force-dynamic";

/** Public account list — access tokens are stripped before serialization. */
export async function GET() {
  const records = await listAccounts();
  return NextResponse.json({ accounts: records.map(toPublic) });
}

interface UpsertBody {
  id?: string;
  label?: string;
  handle?: string;
  igUserId?: string;
  pageId?: string;
  brandId?: string;
  accessToken?: string;
  tokenExpiresAt?: string | null;
}

/**
 * Stores or updates one Instagram page. The token is accepted here and kept
 * server-side only; responses never include it.
 */
export async function POST(request: Request) {
  let body: UpsertBody;
  try {
    body = (await request.json()) as UpsertBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const required = ["label", "handle", "igUserId", "pageId", "brandId"] as const;
  for (const field of required) {
    if (typeof body[field] !== "string" || body[field] === "") {
      return NextResponse.json({ error: `${field} is required` }, { status: 400 });
    }
  }
  if (typeof body.accessToken !== "string" || body.accessToken.length < 10) {
    return NextResponse.json(
      { error: "A valid accessToken is required" },
      { status: 400 },
    );
  }

  const record = await upsertAccount({
    id: body.id,
    label: body.label!,
    handle: body.handle!,
    igUserId: body.igUserId!,
    pageId: body.pageId!,
    brandId: body.brandId!,
    accessToken: body.accessToken,
    tokenExpiresAt: body.tokenExpiresAt ?? null,
  });

  return NextResponse.json({ account: toPublic(record) }, { status: 201 });
}
