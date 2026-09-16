import { NextResponse } from "next/server";

import {
  deleteAccount,
  getAccount,
  setAccountStatus,
  storeRefreshedToken,
} from "@/lib/repositories/instagram-accounts-repository";
import {
  refreshLongLivedToken,
  GraphApiError,
} from "@/lib/instagram/graph-client";

export const dynamic = "force-dynamic";

/** Disconnects one page (token is discarded with the record). */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const deleted = await deleteAccount(id);
  if (!deleted) {
    return NextResponse.json({ error: `No account with id ${id}` }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

/**
 * Rotates the long-lived token. Graph allows refreshing while the current
 * token is still valid; an expired token must go through re-authorisation.
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const account = await getAccount(id);
  if (!account) {
    return NextResponse.json({ error: `No account with id ${id}` }, { status: 404 });
  }

  try {
    const refreshed = await refreshLongLivedToken(account.accessToken);
    await storeRefreshedToken(id, refreshed.accessToken, refreshed.expiresAt);
    return NextResponse.json({ ok: true, expiresAt: refreshed.expiresAt });
  } catch (error) {
    const message =
      error instanceof GraphApiError
        ? error.message
        : "Token refresh failed — reconnect the account";

    if (error instanceof GraphApiError && error.kind === "expired_token") {
      await setAccountStatus(id, "token_expired", message);
    }

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
