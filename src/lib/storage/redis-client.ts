import { Redis } from "@upstash/redis";

import { requireRedisCredentials, resolveStorageDriver } from "@/lib/env";

/**
 * The one Upstash Redis client for this instance.
 *
 * Both the document store and the rate limiter talk to the same database, and
 * each used to construct its own `Redis`. Two clients means two connection
 * pools against an HTTP API that charges per request and throttles per
 * connection — there is no reason for it. Every consumer goes through here.
 *
 * Returns `null` when this deployment is not configured for Redis (local file
 * development). Callers decide what that means for them: the document store
 * falls back to files, the rate limiter falls back to per-process memory.
 * Resolution failures surface as null for the same reason — the storage layer
 * reports the actionable error where the user can see it; a limiter that
 * throws would take down routes it was supposed to protect.
 */

let client: Redis | null | undefined;

export function redisClient(): Redis | null {
  if (client !== undefined) return client;
  try {
    if (resolveStorageDriver() !== "redis") {
      client = null;
    } else {
      const { url, token } = requireRedisCredentials();
      client = new Redis({ url, token, enableAutoPipelining: true });
    }
  } catch {
    client = null;
  }
  return client;
}
