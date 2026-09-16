import { randomUUID } from "node:crypto";

import { encryptSecret, isEncrypted, readSecret } from "@/lib/security/crypto";
import { arrayDocument } from "@/lib/storage";
import type { IgAccount } from "@/types";

/**
 * Access-token storage and account manager for the Instagram pages.
 *
 * Two protections matter here and both are enforced in this module rather than
 * by convention:
 *
 *  - **The token is encrypted at rest.** It grants publishing rights to a real
 *    account for around sixty days, so a plaintext copy in a database dump or a
 *    backup is a takeover. Writes encrypt; reads decrypt.
 *  - **It never leaves the server.** `toPublic` is the only way a record becomes
 *    a response body, and it omits the token entirely. Routes must return the
 *    public shape; there is no other shape to accidentally return.
 */

/** Full record as stored, including the (encrypted) secret. */
export interface IgAccountRecord extends IgAccount {
  accessToken: string;
}

/** On-disk shape: identical, except the token is an envelope string. */
type StoredAccount = Omit<IgAccountRecord, "accessToken"> & {
  accessToken: string;
};

function isStoredAccount(raw: unknown): raw is StoredAccount {
  if (typeof raw !== "object" || raw === null) return false;
  const record = raw as Partial<StoredAccount>;

  return (
    typeof record.id === "string" &&
    typeof record.handle === "string" &&
    typeof record.igUserId === "string" &&
    typeof record.accessToken === "string" &&
    typeof record.status === "string"
  );
}

const accounts = () =>
  arrayDocument<StoredAccount>({
    key: "instagram-accounts",
    isItem: isStoredAccount,
  });

/**
 * Decrypts a stored record for use.
 *
 * A record whose token cannot be decrypted — a rotated key, or a value copied
 * between environments — is surfaced as `token_expired` rather than thrown, so
 * the accounts screen can show what is wrong and offer a reconnect. One bad
 * token must not take down the settings page.
 */
function open(record: StoredAccount): IgAccountRecord {
  try {
    return { ...record, accessToken: readSecret(record.accessToken) };
  } catch {
    return {
      ...record,
      accessToken: "",
      status: "token_expired",
      lastError: "Stored token could not be decrypted. Reconnect this account.",
    };
  }
}

/**
 * Seals a token for storage.
 *
 * Idempotent: an already-encrypted value is passed through untouched, because
 * double-wrapping would make the token unreadable after the second write and
 * the only symptom would be a 401 from Instagram.
 */
function seal(record: IgAccountRecord): StoredAccount {
  const { accessToken } = record;
  if (!accessToken || isEncrypted(accessToken)) return { ...record };
  return { ...record, accessToken: encryptSecret(accessToken) };
}

/** Strips the secret for any response that goes over the wire. */
export function toPublic(record: IgAccountRecord): IgAccount {
  return {
    id: record.id,
    label: record.label,
    handle: record.handle,
    igUserId: record.igUserId,
    pageId: record.pageId,
    brandId: record.brandId,
    status: record.status,
    tokenUpdatedAt: record.tokenUpdatedAt,
    tokenExpiresAt: record.tokenExpiresAt,
    lastError: record.lastError,
    createdAt: record.createdAt,
  };
}

export async function listAccounts(): Promise<IgAccountRecord[]> {
  const records = await accounts().read();
  return records.map(open);
}

export async function getAccount(id: string): Promise<IgAccountRecord | null> {
  const records = await accounts().read();
  const record = records.find((candidate) => candidate.id === id);
  return record ? open(record) : null;
}

/** Finds the account backing a schedule entry's igPage handle. */
export async function findAccountByHandle(
  handle: string,
): Promise<IgAccountRecord | null> {
  const records = await accounts().read();
  const normalised = handle.trim().toLowerCase().replace(/^@/, "");
  const record = records.find(
    (candidate) => candidate.handle.trim().toLowerCase().replace(/^@/, "") === normalised,
  );
  return record ? open(record) : null;
}

export interface UpsertAccountInput {
  id?: string;
  label: string;
  handle: string;
  igUserId: string;
  pageId: string;
  brandId: string;
  accessToken: string;
  tokenExpiresAt?: string | null;
}

/** Creates or updates an account, storing the new token and resetting status. */
export async function upsertAccount(
  input: UpsertAccountInput,
): Promise<IgAccountRecord> {
  const now = new Date().toISOString();
  const newId = `ig-${randomUUID().slice(0, 10)}`;

  const updated = await accounts().mutate((current) => {
    const index = input.id
      ? current.findIndex((candidate) => candidate.id === input.id)
      : -1;

    const record: IgAccountRecord = {
      id: index >= 0 ? current[index].id : newId,
      label: input.label,
      handle: input.handle,
      igUserId: input.igUserId,
      pageId: input.pageId,
      brandId: input.brandId,
      status: "connected",
      tokenUpdatedAt: now,
      tokenExpiresAt: input.tokenExpiresAt ?? null,
      lastError: null,
      accessToken: input.accessToken,
      createdAt: index >= 0 ? current[index].createdAt : now,
    };

    const next = [...current];
    if (index >= 0) next[index] = seal(record);
    else next.push(seal(record));
    return next;
  });

  const saved = updated.find((candidate) => candidate.id === (input.id ?? newId));
  if (!saved) {
    throw new Error("Account was written but could not be read back.");
  }
  return open(saved);
}

export async function deleteAccount(id: string): Promise<boolean> {
  let removed = false;

  await accounts().mutate((current) => {
    const next = current.filter((candidate) => candidate.id !== id);
    if (next.length === current.length) return current;
    removed = true;
    return next;
  });

  return removed;
}

export async function setAccountStatus(
  id: string,
  status: IgAccount["status"],
  lastError?: string | null,
): Promise<void> {
  await accounts().mutate((current) =>
    current.map((record) =>
      record.id === id ? { ...record, status, lastError: lastError ?? null } : record,
    ),
  );
}

/** Stores the rotated token after a refresh exchange. */
export async function storeRefreshedToken(
  id: string,
  accessToken: string,
  tokenExpiresAt: string | null,
): Promise<void> {
  const sealed = accessToken ? encryptSecret(accessToken) : accessToken;

  await accounts().mutate((current) =>
    current.map((record) =>
      record.id === id
        ? {
            ...record,
            accessToken: sealed,
            status: "connected",
            tokenUpdatedAt: new Date().toISOString(),
            tokenExpiresAt,
            lastError: null,
          }
        : record,
    ),
  );
}
