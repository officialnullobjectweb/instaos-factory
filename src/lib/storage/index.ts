import { promises as fs } from "node:fs";
import path from "node:path";

import {
  ConfigurationError,
  resolveStorageDriver,
  serverEnv,
} from "@/lib/env";
import { JsonArrayDocument, JsonDocument } from "@/lib/storage/document";
import type {
  ArrayDocumentConfig,
  DocumentConfig,
} from "@/lib/storage/document";
import { createFileDriver } from "@/lib/storage/file-driver";
import { createRedisDriver } from "@/lib/storage/redis-driver";
import type {
  DriverHealth,
  StorageDriver,
  StoredRecord,
} from "@/lib/storage/types";

/**
 * Chooses the store and hands out document handles.
 *
 * Documents are singletons keyed by their storage key, so every caller shares
 * one in-process cache and one write lock. Identity is the key: two modules
 * that declare the same key with different shapes are a bug, and the first
 * declaration wins — which is why the key and its shape live together in one
 * repository module.
 */

let resolved: StorageDriver | null = null;

/**
 * A driver that can read but never write.
 *
 * Used when no store is configured on a host that cannot persist to disk. The
 * alternative — throwing on first use — takes the whole app down at import
 * time, so a missing environment variable presents as a blank error page with
 * no clue in it. This way every screen still renders from the committed
 * fixtures, and the first write fails with a message naming the variable to
 * set. Broken reads are diagnosable; silent writes are not.
 */
function createReadOnlyDriver(reason: string): StorageDriver {
  const seedDir = path.join(process.cwd(), "data");

  return {
    id: "file",
    conditionalWrite: false,

    async get(key: string): Promise<StoredRecord | null> {
      try {
        const raw = await fs.readFile(path.join(seedDir, `${key}.json`), "utf8");
        // The fixture is a constant, so its version is too: every instance
        // agrees on it, and nothing can legitimately be written over it.
        return { value: JSON.parse(raw) as unknown, version: "seed" };
      } catch {
        return null;
      }
    },

    async set(): Promise<never> {
      throw new ConfigurationError(reason);
    },

    async remove(): Promise<never> {
      throw new ConfigurationError(reason);
    },

    async health(): Promise<DriverHealth> {
      return { ok: false, detail: reason };
    },
  };
}

export function storage(): StorageDriver {
  if (resolved) return resolved;

  try {
    resolved =
      resolveStorageDriver() === "redis"
        ? createRedisDriver()
        : createFileDriver();
  } catch (error) {
    if (!(error instanceof ConfigurationError)) throw error;

    if (serverEnv().NODE_ENV !== "test") {
      console.warn(`[storage] ${error.message}`);
    }
    resolved = createReadOnlyDriver(error.message);
  }

  return resolved;
}

/* -------------------------------------------------------------------------- */
/*  Document registry                                                         */
/* -------------------------------------------------------------------------- */

const registry = new Map<string, unknown>();

/** A JSON object document. Stable per key. */
export function document<T>(config: DocumentConfig<T>): JsonDocument<T> {
  const existing = registry.get(config.key);
  if (existing) return existing as JsonDocument<T>;

  const created = new JsonDocument<T>(storage(), config);
  registry.set(config.key, created);
  return created;
}

/** A JSON array document, with item guards and an optional cap. */
export function arrayDocument<T>(
  config: ArrayDocumentConfig<T>,
): JsonArrayDocument<T> {
  const existing = registry.get(config.key);
  if (existing) return existing as JsonArrayDocument<T>;

  const created = new JsonArrayDocument<T>(storage(), config);
  registry.set(config.key, created);
  return created;
}

/* -------------------------------------------------------------------------- */
/*  Operations                                                                */
/* -------------------------------------------------------------------------- */

export interface StorageStatus {
  driver: StorageDriver["id"];
  /** True when writes are durable and shared across instances. */
  durable: boolean;
  health: DriverHealth;
}

export async function storageStatus(): Promise<StorageStatus> {
  const driver = storage();
  const health = await driver.health();

  return {
    driver: driver.id,
    // A writable disk on a serverless host is an illusion, so `/tmp` is not
    // counted as durable even though writes appear to succeed.
    durable:
      health.ok &&
      (driver.id === "redis" ||
        !serverEnv().VERCEL ||
        !health.detail.includes("Ephemeral")),
    health,
  };
}

/**
 * Clears the given documents so the next read re-seeds from the fixtures.
 *
 * Used by the seed scripts: the fixtures are rewritten on disk, and any live
 * store has to be dropped too or the running app would keep serving the old
 * dataset.
 */
export async function resetDocuments(keys: string[]): Promise<void> {
  for (const key of keys) {
    const entry = registry.get(key) as JsonDocument<unknown> | undefined;
    if (entry) {
      await entry.reset();
      continue;
    }
    await storage().remove(key);
  }
}

/** Every key this app stores, in the order the seed scripts expect. */
export const DOCUMENT_KEYS = [
  "posts",
  "schedule",
  "audit",
  "ai-logs",
  "telegram-log",
  "instagram-accounts",
  "instagram-history",
  "experiments",
  "design-templates",
  "learning",
  "insights",
] as const;

export type DocumentKey = (typeof DOCUMENT_KEYS)[number];

export { JsonArrayDocument, JsonDocument };
export type { ArrayDocumentConfig, DocumentConfig };
