import { z } from "zod";

/**
 * The single place environment configuration is read, validated and typed.
 *
 * Nothing else in the app should touch `process.env` for a value that matters.
 * Hand-rolled reads (`Number(x) || 900`, `x === "true"`) are how production
 * incidents start: a typo in a variable name silently becomes a default, and a
 * tuning value of `0` or `"yes "` is quietly discarded. Here every variable is
 * parsed once, and a malformed value fails with the variable's name and the
 * reason rather than degrading into something plausible.
 *
 * Two deliberate design choices:
 *
 * 1. **Almost nothing is required.** The app runs with an empty environment —
 *    the offline provider means generation works without a single API key. A
 *    global "required" list would break that, and it would also break
 *    `next build`, which imports this module on machines that have no secrets.
 *
 * 2. **Requirements are scoped to the feature that needs them.** Asking for a
 *    Redis URL only makes sense if you chose an external store; asking for a
 *    webhook secret only matters when the webhook route runs. Those checks live
 *    in `requireRedis()` / `requireEncryptionKey()` and throw at the moment of
 *    use, where the message can say what to do about it.
 */

/* -------------------------------------------------------------------------- */
/*  Parsing helpers                                                           */
/* -------------------------------------------------------------------------- */

/**
 * An absent or blank variable is `undefined`, never `""`.
 *
 * This matters more than it looks: `INSTAGRAM_APP_SECRET=` in a `.env` file is
 * extremely common, and treating it as the empty string would make an
 * unconfigured integration look configured.
 */
const optionalString = () =>
  z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === "" ? undefined : value,
    z.string().trim().optional(),
  );

/** A number with a fallback, rejecting values that are present but nonsense. */
const number = (fallback: number) =>
  z
    .preprocess((value) => {
      if (value === undefined || value === null) return fallback;
      if (typeof value === "string" && value.trim() === "") return fallback;
      return value;
    }, z.coerce.number().finite().positive())
    .default(fallback);

const boolean = (fallback: boolean) =>
  z
    .preprocess((value) => {
      if (value === undefined || value === null) return fallback;
      if (typeof value === "boolean") return value;
      return ["1", "true", "yes", "on"].includes(String(value).trim().toLowerCase());
    }, z.boolean())
    .default(fallback);

/** Comma-separated list, tolerating spaces and trailing commas. */
const csv = () =>
  z
    .preprocess(
      (value) =>
        typeof value === "string"
          ? value
              .split(",")
              .map((entry) => entry.trim())
              .filter(Boolean)
          : value,
      z.array(z.string()).optional(),
    )
    .default([]);

/** Absolute http(s) URL, or `undefined` when unset. */
const optionalUrl = () =>
  z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === "" ? undefined : value,
    z.string().trim().url().optional(),
  );

const logLevel = z.enum(["debug", "info", "warn", "error", "silent"]);

/* -------------------------------------------------------------------------- */
/*  Schema                                                                    */
/* -------------------------------------------------------------------------- */

const serverSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  /* --- Runtime identity ---------------------------------------------------- */

  APP_BASE_URL: optionalUrl(),
  /**
   * Set by Vercel on every deployment. Used to build absolute URLs (Instagram's
   * crawler needs a public `image_url`) without hardcoding a domain.
   */
  VERCEL_URL: optionalString(),
  VERCEL_ENV: z.enum(["production", "preview", "development"]).optional(),
  /** Present on Vercel deployments; `undefined` locally and on other hosts. */
  VERCEL: optionalString(),

  /* --- Persistence --------------------------------------------------------- */

  /**
   * `file` keeps state in `data/*.json` (local development).
   * `redis` keeps it in Upstash, which is the only option on a serverless host:
   * Vercel's filesystem is read-only apart from an ephemeral `/tmp` that is not
   * shared between instances, so a file-backed write there is lost or ignored.
   * Left unset, it is inferred — see `resolveStorageDriver`.
   */
  STORAGE_DRIVER: z.enum(["file", "redis"]).optional(),
  UPSTASH_REDIS_REST_URL: optionalUrl(),
  UPSTASH_REDIS_REST_TOKEN: optionalString(),
  /** Namespaces every key, so one Redis database can host several deploys. */
  STORAGE_PREFIX: z.string().trim().default("factory"),

  /**
   * 32 bytes, hex or base64. Encrypts Instagram access tokens at rest.
   */
  TOKEN_ENCRYPTION_KEY: optionalString(),

  /* --- AI providers -------------------------------------------------------- */

  AI_PROVIDER_ORDER: csv(),
  AI_REQUEST_TIMEOUT_MS: number(45_000),
  AI_MAX_ATTEMPTS: number(3),
  AI_MAX_REPAIR_ATTEMPTS: number(1),
  AI_BACKOFF_BASE_MS: number(900),
  AI_BACKOFF_MAX_MS: number(12_000),
  AI_GRANULAR_STEPS: boolean(true),

  GEMINI_API_KEY: optionalString(),
  /**
   * Verified working default. Newer point releases (3.7/3.8) have returned
   * 503 "high demand" for extended windows; 3.6 is the release this pipeline
   * was validated against. Override freely as models move.
   */
  GEMINI_MODEL: z.string().trim().default("gemini-3.6-flash"),
  GEMINI_BASE_URL: z
    .string()
    .trim()
    .url()
    .default("https://generativelanguage.googleapis.com/v1beta"),

  GROQ_API_KEY: optionalString(),
  /**
   * Verified working default. Groq retired its Llama 3.x catalog
   * (`llama-3.3-70b-versatile` now 404s with model_not_found); gpt-oss-120b is
   * the current JSON-mode-capable flagship.
   */
  GROQ_MODEL: z.string().trim().default("openai/gpt-oss-120b"),
  GROQ_BASE_URL: z.string().trim().url().default("https://api.groq.com/openai/v1"),

  OPENROUTER_API_KEY: optionalString(),
  OPENROUTER_MODEL: z.string().trim().default("openai/gpt-oss-120b"),
  OPENROUTER_BASE_URL: z
    .string()
    .trim()
    .url()
    .default("https://openrouter.ai/api/v1"),
  OPENROUTER_REFERER: z.string().trim().default("https://factory.os"),
  OPENROUTER_TITLE: z.string().trim().default("Instagram Factory OS"),

  NARA_API_KEY: optionalString(),
  NARA_MODEL: z.string().trim().default("laguna-s-2.1"),
  NARA_BASE_URL: z
    .string()
    .trim()
    .url()
    .default("https://router.bynara.id/v1"),

  /**
   * The offline engine, last in the chain and deterministic. It is what makes
   * the pipeline runnable end to end with no hosted key, so it is on by default
   * in development and off by default in production — where silently serving
   * generated-looking fixture copy would be worse than an honest error.
   */
  AI_ENABLE_LOCAL_PROVIDER: boolean(false),
  AI_LOCAL_MODEL: z.string().trim().default("factory-offline-v1"),

  /* --- Instagram ----------------------------------------------------------- */

  INSTAGRAM_APP_ID: optionalString(),
  INSTAGRAM_APP_SECRET: optionalString(),
  INSTAGRAM_GRAPH_URL: z
    .string()
    .trim()
    .url()
    .default("https://graph.facebook.com/v21.0"),

  /* --- Callers outside the browser ---------------------------------------- */

  /** Shared secret for `/api/schedule/process`. Required in production. */
  SCHEDULER_SECRET: optionalString(),
  /** Where the standalone scripts look for the app. */
  SCHEDULER_URL: optionalUrl(),
  /** Sent by Vercel Cron as `Authorization: Bearer …`. */
  CRON_SECRET: optionalString(),

  TELEGRAM_BOT_TOKEN: optionalString(),
  TELEGRAM_CHAT_ID: optionalString(),
  /** Required by `/api/telegram/callback`, which mutates real content. */
  TELEGRAM_WEBHOOK_SECRET: optionalString(),

  /* --- Observability ------------------------------------------------------ */

  LOG_LEVEL: logLevel.optional(),
  /** Sampling for request logs; 1 logs every request. */
  LOG_SAMPLE_RATE: number(1),
});

export type ServerEnv = z.infer<typeof serverSchema>;

/* -------------------------------------------------------------------------- */
/*  Validation                                                                */
/* -------------------------------------------------------------------------- */

function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const name = issue.path.join(".") || "(root)";
      return `  • ${name}: ${issue.message}`;
    })
    .join("\n");
}

let cached: ServerEnv | null = null;

/**
 * Validates and caches the environment.
 *
 * The result is memoised because this is read on nearly every request and the
 * schema walk is pure. A failed parse is never cached, so fixing an env var and
 * restarting the dev server behaves as expected.
 */
export function serverEnv(): ServerEnv {
  if (cached) return cached;

  const parsed = serverSchema.safeParse(process.env);

  if (!parsed.success) {
    throw new Error(
      `Invalid environment configuration:\n${formatIssues(parsed.error)}\n\n` +
        "Check .env.example for the expected shape of each variable.",
    );
  }

  cached = normalise(parsed.data);
  return cached;
}

/**
 * Production adjustments applied after parsing, kept in one place so the raw
 * schema stays a statement of *shape* rather than of policy.
 */
function normalise(env: ServerEnv): ServerEnv {
  const isProduction = env.NODE_ENV === "production";

  return {
    ...env,
    // Offline generation is a development convenience. In production it must be
    // asked for explicitly; a deployment that quietly serves fixture copy while
    // appearing to call a model is the worst possible failure mode.
    AI_ENABLE_LOCAL_PROVIDER:
      env.AI_ENABLE_LOCAL_PROVIDER || (!isProduction && !env.GEMINI_API_KEY),
    LOG_LEVEL: env.LOG_LEVEL ?? (isProduction ? "info" : "debug"),
  };
}

/* -------------------------------------------------------------------------- */
/*  Feature-scoped requirements                                               */
/* -------------------------------------------------------------------------- */

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}

/** True when running on Vercel (any environment: production or preview). */
export function isServerless(): boolean {
  return Boolean(serverEnv().VERCEL);
}

/**
 * Which persistence driver to use.
 *
 * Inference exists so the common cases need no configuration at all: local
 * development and CI get files, a deployment with Upstash credentials gets
 * Redis. What it must never do is fall back to files on a serverless host —
 * that silently discards every write. An unconfigured deployment fails loudly
 * here instead.
 */
export function resolveStorageDriver(): "file" | "redis" {
  const env = serverEnv();

  if (env.STORAGE_DRIVER) return env.STORAGE_DRIVER;

  if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) return "redis";

  if (isServerless()) {
    throw new ConfigurationError(
      "No persistent store is configured for this deployment.\n\n" +
        "Vercel's filesystem is read-only except for an ephemeral /tmp that is " +
        "not shared between instances, so writes to data/*.json are lost.\n\n" +
        "Fix: create an Upstash Redis database (free tier is enough) and set\n" +
        "  UPSTASH_REDIS_REST_URL\n" +
        "  UPSTASH_REDIS_REST_TOKEN\n" +
        "or set STORAGE_DRIVER=file to accept that state does not persist.",
    );
  }

  return "file";
}

export function requireRedisCredentials(): {
  url: string;
  token: string;
} {
  const env = serverEnv();
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
    throw new ConfigurationError(
      "STORAGE_DRIVER=redis requires both UPSTASH_REDIS_REST_URL and " +
        "UPSTASH_REDIS_REST_TOKEN.",
    );
  }
  return {
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
  };
}

/**
 * The key used to encrypt Instagram access tokens at rest.
 *
 * Deliberately lazy: a deployment that has not connected an Instagram account
 * should not be forced to hold a key it cannot use. Once an account is saved,
 * a missing key is a hard error rather than a silent plaintext write.
 */
export function requireEncryptionKey(): Buffer {
  const raw = serverEnv().TOKEN_ENCRYPTION_KEY;

  if (!raw) {
    throw new ConfigurationError(
      "TOKEN_ENCRYPTION_KEY is required to store Instagram access tokens.\n\n" +
        "Generate one with:\n" +
        '  node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"\n\n' +
        "Without it, tokens would be written in plaintext or lost on redeploy.",
    );
  }

  const buffer = /^[0-9a-fA-F]{64}$/.test(raw)
    ? Buffer.from(raw, "hex")
    : Buffer.from(raw, "base64");

  if (buffer.length !== 32) {
    throw new ConfigurationError(
      `TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes (got ${buffer.length}). ` +
        "Provide 64 hex characters or a base64-encoded 32-byte value.",
    );
  }

  return buffer;
}

export function requireSchedulerSecret(): string {
  const secret = serverEnv().SCHEDULER_SECRET;
  if (!secret) {
    throw new ConfigurationError(
      "SCHEDULER_SECRET is not set. /api/schedule/process can trigger real " +
        "publishes, so it must be authenticated in production.",
    );
  }
  return secret;
}

export function requireTelegramWebhookSecret(): string {
  const secret = serverEnv().TELEGRAM_WEBHOOK_SECRET;
  if (!secret) {
    throw new ConfigurationError(
      "TELEGRAM_WEBHOOK_SECRET is not set. /api/telegram/callback approves " +
        "and rejects real content, so it must be authenticated.",
    );
  }
  return secret;
}

/**
 * The public base URL, used wherever an absolute URL has to leave the server —
 * most importantly Instagram's crawler fetching slide images.
 */
export function appBaseUrl(): string {
  const env = serverEnv();
  if (env.APP_BASE_URL) return env.APP_BASE_URL.replace(/\/$/, "");
  if (env.VERCEL_URL) {
    return `https://${env.VERCEL_URL.replace(/\/$/, "")}`;
  }
  // Matches the dev/start port in package.json (3780); PORT wins if set.
  return `http://localhost:${process.env.PORT ?? "3780"}`;
}

/* -------------------------------------------------------------------------- */
/*  Diagnostics                                                               */
/* -------------------------------------------------------------------------- */

export interface EnvReport {
  name: string;
  configured: boolean;
  /** Never the value — only whether it exists and what it is for. */
  purpose: string;
  requiredFor: string | null;
}

/**
 * What is configured, without ever revealing a secret.
 *
 * Used by the health endpoint and the settings screen so an operator can see
 * that a key is missing instead of inferring it from a feature not working.
 */
export function envReport(): EnvReport[] {
  const env = serverEnv();
  const report: Array<[string, unknown, string, string | null]> = [
    ["Upstash Redis", env.UPSTASH_REDIS_REST_URL, "Persistent state", "Deployment"],
    ["AI provider order", env.AI_PROVIDER_ORDER.length > 0, "Fallback chain order", null],
    ["Gemini key", env.GEMINI_API_KEY, "Primary generation model", "Content generation"],
    ["Groq key", env.GROQ_API_KEY, "First fallback model", null],
    ["Nara key", env.NARA_API_KEY, "Third fallback model", null],
    ["OpenRouter key", env.OPENROUTER_API_KEY, "Second fallback model", null],
    ["Offline provider", env.AI_ENABLE_LOCAL_PROVIDER, "Runs the pipeline with no hosted key", null],
    ["Token encryption", env.TOKEN_ENCRYPTION_KEY, "Encrypts Instagram tokens at rest", "Instagram accounts"],
    ["Instagram app", env.INSTAGRAM_APP_ID, "Graph API OAuth and publish", "Publishing"],
    ["Scheduler secret", env.SCHEDULER_SECRET, "Authenticates the publish tick", "Scheduled publishing"],
    ["Vercel cron secret", env.CRON_SECRET, "Authenticates cron invocations", null],
    ["Telegram bot", env.TELEGRAM_BOT_TOKEN, "Review notifications", null],
    ["Telegram webhook", env.TELEGRAM_WEBHOOK_SECRET, "Authenticates decisions from Telegram", "Telegram decisions"],
  ];

  return report.map(([name, value, purpose, requiredFor]) => ({
    name,
    configured: Boolean(value),
    purpose,
    requiredFor,
  }));
}
