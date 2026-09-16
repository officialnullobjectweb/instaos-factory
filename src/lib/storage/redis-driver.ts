import { serverEnv } from "@/lib/env";
import { redisClient } from "@/lib/storage/redis-client";
import type {
  DriverHealth,
  StorageDriver,
  StoredRecord,
  Version,
  WriteResult,
} from "@/lib/storage/types";

/**
 * Upstash Redis driver — the production store.
 *
 * Needed because a serverless host has no durable disk. Vercel serves the
 * deployment read-only and offers `/tmp`, which is per-instance and discarded
 * on cold start, so a file-backed write there is either rejected or quietly
 * lost. This driver moves the same JSON documents into Redis over HTTP, which
 * works from any runtime without a long-lived connection pool.
 *
 * **On the concurrency guarantee.** `set` reads the current revision, compares
 * it, and only then writes — a check-then-write, not a transaction. Two writers
 * interleaving inside that window can both pass the check, and the later write
 * wins. Two things make that acceptable here rather than hidden:
 *
 *  - Every mutation is a pure function of the current document, so the caller
 *    can (and does) retry it safely. `conditionalWrite: false` tells the
 *    document layer not to trust this driver's check as authoritative.
 *  - The previous implementation had no cross-process check at all — it relied
 *    on an in-process promise chain and an mtime comparison. This is strictly
 *    stronger, and honest about where it stops.
 *
 * If true atomicity is ever needed, Upstash supports `EVAL`, and the check and
 * write below can move into a Lua script without touching any caller.
 */


/** Versioned envelope: the revision travels with the data in a single key. */
interface Envelope {
  v: number;
  d: unknown;
}

function isEnvelope(value: unknown): value is Envelope {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Envelope).v === "number" &&
    "d" in (value as Envelope)
  );
}

function keyFor(key: string): string {
  return `${serverEnv().STORAGE_PREFIX}:${key}`;
}

export function createRedisDriver(): StorageDriver {
  // The driver is only constructed when the resolved driver is Redis, so a
  // null client here would mean the environment changed mid-boot. Fail with
  // the actionable message rather than a null dereference inside a command.
  const upstash = redisClient();
  if (!upstash) {
    throw new Error(
      "Redis driver created without credentials — check STORAGE_DRIVER and " +
        "the UPSTASH_REDIS_REST_* variables.",
    );
  }

  return {
    id: "redis",
    // The check is real but not atomic; see the note above.
    conditionalWrite: false,

    async get(key) {
      const raw = await upstash.get<unknown>(keyFor(key));
      if (raw === null || raw === undefined) return null;

      // The SDK deserialises JSON automatically, but a value written by another
      // tool (or a future version) may arrive as a string.
      const parsed = typeof raw === "string" ? safeParse(raw) : raw;
      if (!isEnvelope(parsed)) return null;

      return {
        value: parsed.d,
        version: String(parsed.v),
      } satisfies StoredRecord;
    },

    async set(key, value, expectedVersion) {
      const storeKey = keyFor(key);
      const current = await upstash.get<unknown>(storeKey);
      const currentEnvelope =
        typeof current === "string" ? safeParse(current) : current;
      const currentVersion = isEnvelope(currentEnvelope)
        ? String(currentEnvelope.v)
        : null;

      if (currentVersion !== expectedVersion) {
        return { ok: false, version: currentVersion ?? "" } satisfies WriteResult;
      }

      // Monotonic per document, so a version is never reused even after a
      // delete and recreate.
      const next = (isEnvelope(currentEnvelope) ? currentEnvelope.v : 0) + 1;
      await upstash.set(storeKey, { v: next, d: value } satisfies Envelope);

      return { ok: true, version: String(next) } satisfies WriteResult;
    },

    async remove(key) {
      await upstash.del(keyFor(key));
    },

    async health(): Promise<DriverHealth> {
      const started = Date.now();
      try {
        const probe = `${serverEnv().STORAGE_PREFIX}:health`;
        await upstash.set(probe, { at: new Date().toISOString() });
        const read = await upstash.get<{ at?: string }>(probe);
        const latencyMs = Date.now() - started;

        return read
          ? { ok: true, latencyMs, detail: `Reachable (${latencyMs} ms round trip).` }
          : { ok: false, latencyMs, detail: "Write succeeded but the read returned nothing." };
      } catch (error) {
        return {
          ok: false,
          detail:
            error instanceof Error
              ? `Unreachable: ${error.message}`
              : "Unreachable.",
        };
      }
    },
  };
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

export type { Version };
