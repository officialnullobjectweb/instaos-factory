import { redisClient } from "@/lib/storage/redis-client";

/**
 * Fixed-window rate limiting for the routes that can cost money or corrupt
 * state: generation (provider quota), publishing (Instagram quota), the
 * scheduler tick (double-publish), the learning run (weight churn).
 *
 * Prompt 8 asks for rate limiting and the deployment plan chose Upstash for
 * persistence — the same Redis that stores the documents also holds the
 * counters, so limits are shared across every serverless instance. A per-box
 * in-memory limiter on Vercel is not a limiter: each warm instance keeps its
 * own count and the real rate is instances × limit.
 *
 * When Redis is not configured (local development) the limiter degrades to
 * per-process memory. That is the right compromise in one direction only: it
 * protects a local dev server and keeps `npm run dev` free of configuration,
 * but it must not be mistaken for production limiting — `driver` says which
 * one answered so a misconfigured deployment is visible in the response.
 *
 * The algorithm is a fixed window (INCR + EXPIRE). A token bucket would be
 * smoother, but the fixed window is two Redis commands, needs no Lua, and for
 * this threat model — a human clicking generate, a cron that retries — the
 * boundary artefact (2× burst at window edges) is irrelevant. Simple here is
 * a feature: it is auditable at a glance.
 */

interface LimiterOptions {
  /** Unique per logical action — includes the route name. */
  name: string;
  /** Allowed requests per window. */
  limit: number;
  /** Window length in seconds. */
  windowSeconds: number;
}

interface LimitResult {
  ok: boolean;
  /** Requests remaining in this window. */
  remaining: number;
  /** Seconds until the window resets; present when the request was refused. */
  retryAfterSeconds?: number;
  /** Which backend enforced the limit. */
  driver: "redis" | "memory";
}

const memoryCounters = new Map<string, { count: number; resetAt: number }>();

/**
 * Consumes one slot for `identity` (an IP, a route, a post id).
 *
 * Returns the decision and, when refused, how long to wait — the routes turn
 * that into `Retry-After`, which is what a well-behaved client needs.
 */
export async function rateLimit(
  identity: string,
  options: LimiterOptions,
): Promise<LimitResult> {
  const key = `ratelimit:${options.name}:${identity}`;
  const windowMs = options.windowSeconds * 1000;

  const client = redisClient();
  if (client) {
    // INCR then EXPIRE — the counter and its TTL. The pipeline saves a round
    // trip and keeps the two commands adjacent.
    const pipe = client.pipeline();
    pipe.incr(key);
    // Only the first request in a window sets the expiry; re-setting it on
    // every hit would extend the window indefinitely under load.
    pipe.expire(key, options.windowSeconds, "nx");
    const [count] = (await pipe.exec()) as [number, unknown];

    if (count > options.limit) {
      const ttl = await client.ttl(key);
      return {
        ok: false,
        remaining: 0,
        retryAfterSeconds: ttl > 0 ? ttl : options.windowSeconds,
        driver: "redis",
      };
    }

    return { ok: true, remaining: Math.max(0, options.limit - count), driver: "redis" };
  }

  /* ------------------------- in-memory fallback -------------------------- */

  const now = Date.now();
  const entry = memoryCounters.get(key);

  if (!entry || entry.resetAt <= now) {
    memoryCounters.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: options.limit - 1, driver: "memory" };
  }

  entry.count += 1;
  if (entry.count > options.limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000),
      driver: "memory",
    };
  }
  return { ok: true, remaining: options.limit - entry.count, driver: "memory" };
}

/**
 * Best-effort identity for an incoming request.
 *
 * Vercel provides the real client IP in `x-forwarded-for` (it strips the
 * proxy chain it terminates). The route name is part of every key, so two
 * routes never share a window even for the same caller.
 */
export function clientIdentity(request: Request, route: string): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim();
  return `${route}:${ip || "anonymous"}`;
}

/** Standard 429 body with the headers a retrying client wants. */
export function tooManyRequests(result: LimitResult): Response {
  return new Response(
    JSON.stringify({
      error: "Too many requests",
      detail:
        `This action is rate limited. Try again in ` +
        `${result.retryAfterSeconds ?? 60}s.`,
      driver: result.driver,
    }),
    {
      status: 429,
      headers: {
        "content-type": "application/json",
        ...(result.retryAfterSeconds
          ? { "retry-after": String(result.retryAfterSeconds) }
          : {}),
      },
    },
  );
}

/**
 * Convenience wrapper for route handlers: runs `rateLimit` and returns the
 * 429 response when the caller has spent their window.
 */
export async function limitOr429(
  request: Request,
  options: LimiterOptions & { route: string },
): Promise<Response | null> {
  const result = await rateLimit(clientIdentity(request, options.route), options);
  return result.ok ? null : tooManyRequests(result);
}
