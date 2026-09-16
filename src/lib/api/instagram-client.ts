import type {
  IgAccount,
  IgMediaKind,
  IgPublishRecord,
  IgPublishSummary,
} from "@/types";

/**
 * Typed fetch layer for the Instagram surfaces. Same discipline as the posts
 * and schedule clients: plain functions, explicit errors, no hidden retries.
 *
 * Access tokens travel one way only — they go up on connect and are never
 * present in any response shape.
 */

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });

  const payload = (await response.json().catch(() => null)) as
    | (T & { error?: string })
    | null;

  if (!response.ok || payload === null) {
    throw new Error(payload?.error ?? `Request failed (${response.status})`);
  }
  return payload;
}

export async function fetchInstagramAccounts(): Promise<IgAccount[]> {
  const { accounts } = await request<{ accounts: IgAccount[] }>(
    "/api/instagram/accounts",
  );
  return accounts;
}

export interface ConnectAccountInput {
  id?: string;
  label: string;
  handle: string;
  igUserId: string;
  pageId: string;
  brandId: string;
  accessToken: string;
  tokenExpiresAt?: string | null;
}

export async function connectInstagramAccount(
  input: ConnectAccountInput,
): Promise<IgAccount> {
  const { account } = await request<{ account: IgAccount }>(
    "/api/instagram/accounts",
    { method: "POST", body: JSON.stringify(input) },
  );
  return account;
}

export async function disconnectInstagramAccount(id: string): Promise<void> {
  await request<{ ok: true }>(`/api/instagram/accounts/${id}`, {
    method: "DELETE",
  });
}

/** Rotates the long-lived token in place. */
export async function refreshInstagramToken(
  id: string,
): Promise<{ expiresAt: string | null }> {
  return request<{ ok: true; expiresAt: string | null }>(
    `/api/instagram/accounts/${id}`,
    { method: "POST" },
  );
}

export interface PublishHistoryPayload {
  records: IgPublishRecord[];
  summary: IgPublishSummary;
}

export async function fetchPublishHistory(
  limit = 50,
): Promise<PublishHistoryPayload> {
  return request<PublishHistoryPayload>(
    `/api/instagram/history?limit=${limit}`,
  );
}

/** Manual "publish now" for a failed slot — re-enters the queue. */
export async function requeueSlot(slotId: string): Promise<void> {
  await request<{ ok: true }>("/api/instagram/publish", {
    method: "POST",
    body: JSON.stringify({ slotId }),
  });
}

/**
 * Public URL the Graph API crawler fetches for one rendered slide. Instagram
 * pulls images by URL, so this must be reachable from the outside world.
 */
export function slideMediaUrl(postId: string, slide: number): string {
  return `/api/instagram/media/${postId}/${slide}`;
}

export type { IgMediaKind };
