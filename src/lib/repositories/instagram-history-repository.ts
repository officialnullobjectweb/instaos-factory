import { randomUUID } from "node:crypto";

import { arrayDocument } from "@/lib/storage";
import type { IgPublishRecord, IgPublishSummary } from "@/types";

/**
 * Every successful publish lands here: post, account, media id, permalink and
 * timestamp. Analytics reads this, and duplicate-publish prevention checks it
 * before uploading anything — so a row without a usable `postId` or `mediaId`
 * is a correctness problem, not a cosmetic one, and is dropped on read.
 */

const MAX_RECORDS = 1000;

function isPublishRecord(raw: unknown): raw is IgPublishRecord {
  if (typeof raw !== "object" || raw === null) return false;
  const record = raw as Partial<IgPublishRecord>;

  return (
    typeof record.id === "string" &&
    typeof record.postId === "string" &&
    typeof record.mediaId === "string" &&
    typeof record.publishedAt === "string" &&
    typeof record.handle === "string"
  );
}

const history = () =>
  arrayDocument<IgPublishRecord>({
    key: "instagram-history",
    isItem: isPublishRecord,
    maxItems: MAX_RECORDS,
  });

export interface NewPublishRecord {
  postId: string;
  postTitle: string;
  accountId: string;
  igUserId: string;
  handle: string;
  brandId: string;
  mediaKind: IgPublishRecord["mediaKind"];
  mediaId: string;
  permalink: string;
  elapsedMs: number;
  attempt: number;
}

export async function recordPublish(
  input: NewPublishRecord,
): Promise<IgPublishRecord> {
  const record: IgPublishRecord = {
    ...input,
    id: `pub-${randomUUID().slice(0, 12)}`,
    publishedAt: new Date().toISOString(),
  };

  await history().prepend(record);
  return record;
}

export async function listHistory(limit = 100): Promise<IgPublishRecord[]> {
  const records = await history().read();
  // Returned by value: callers must not be able to mutate the cached document.
  return records.slice(0, limit).map((record) => ({ ...record }));
}

export async function findByPostId(
  postId: string,
): Promise<IgPublishRecord | null> {
  const records = await history().read();
  const record = records.find((candidate) => candidate.postId === postId);
  return record ? { ...record } : null;
}

export async function summariseHistory(): Promise<IgPublishSummary> {
  const records = await history().read();
  const weekAgo = Date.now() - 7 * 24 * 60 * 60_000;

  const byAccount = new Map<string, number>();
  for (const record of records) {
    byAccount.set(record.handle, (byAccount.get(record.handle) ?? 0) + 1);
  }

  return {
    total: records.length,
    last7Days: records.filter(
      (record) => new Date(record.publishedAt).getTime() >= weekAgo,
    ).length,
    byAccount: [...byAccount.entries()]
      .map(([handle, count]) => ({ handle, count }))
      .sort((a, b) => b.count - a.count),
    lastPublishedAt: records[0]?.publishedAt ?? null,
  };
}
