import type { AiErrorKind, AiProviderId } from "@/types";

/**
 * Every failure in the engine is one of these, and the kind decides what the
 * manager does next:
 *
 * - retryable   → same provider, exponential backoff
 * - fatal       → move to the next provider in the chain immediately
 * - invalid_json/schema → worth one retry, then the next provider (a different
 *   model often produces clean JSON where this one did not)
 */
export class AiError extends Error {
  readonly kind: AiErrorKind;
  readonly httpStatus: number | null;
  readonly retryAfterMs: number | null;
  readonly provider: AiProviderId | null;

  constructor(
    kind: AiErrorKind,
    message: string,
    options: {
      httpStatus?: number | null;
      retryAfterMs?: number | null;
      provider?: AiProviderId | null;
      cause?: unknown;
    } = {},
  ) {
    super(message);
    this.name = "AiError";
    this.kind = kind;
    this.httpStatus = options.httpStatus ?? null;
    this.retryAfterMs = options.retryAfterMs ?? null;
    this.provider = options.provider ?? null;
    if (options.cause !== undefined) this.cause = options.cause;
  }

  /** Worth trying again on the same provider. */
  get retryable() {
    return (
      this.kind === "rate_limit" ||
      this.kind === "timeout" ||
      this.kind === "network" ||
      this.kind === "server" ||
      this.kind === "invalid_json" ||
      // A re-roll usually fixes a schema miss: models are rarely wrong twice in
      // the same place on structured output.
      this.kind === "schema"
    );
  }

  /** No point retrying here — the provider cannot serve this request at all. */
  get providerFatal() {
    return (
      this.kind === "quota" ||
      this.kind === "auth" ||
      this.kind === "not_configured" ||
      this.kind === "unsupported"
    );
  }

  /** Machine-readable summary stored in the AI log. */
  toLog() {
    return {
      kind: this.kind,
      message: this.message,
      httpStatus: this.httpStatus,
    };
  }
}

const QUOTA_MARKERS = [
  "resource_exhausted",
  "quota",
  "quota exceeded",
  "exceeded your current quota",
  "insufficient_quota",
  "billing",
];

const RATE_LIMIT_MARKERS = [
  "rate limit",
  "rate_limit",
  "too many requests",
  "requests per",
  "tokens per minute",
  "tpm",
  "rpm",
];

function bodyText(body: unknown) {
  if (typeof body === "string") return body.toLowerCase();
  try {
    return JSON.stringify(body).toLowerCase();
  } catch {
    return "";
  }
}

function parseRetryAfter(headers: Headers | undefined) {
  const raw = headers?.get("retry-after");
  if (!raw) return null;

  const seconds = Number(raw);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);

  const date = Date.parse(raw);
  if (!Number.isNaN(date)) return Math.max(0, date - Date.now());

  return null;
}

/**
 * Maps an HTTP failure onto the taxonomy. Status codes are the primary signal;
 * bodies are only consulted to tell a quota exhaustion apart from a plain rate
 * limit, because the two need opposite responses (switch provider vs wait).
 */
export function classifyHttpFailure(input: {
  status: number;
  body: unknown;
  provider: AiProviderId;
  headers?: Headers;
}): AiError {
  const { status, body, provider } = input;
  const text = bodyText(body);
  const retryAfterMs = parseRetryAfter(input.headers);

  if (status === 401 || status === 403) {
    return new AiError("auth", `Provider rejected the API key (HTTP ${status}).`, {
      httpStatus: status,
      provider,
    });
  }

  if (status === 402) {
    return new AiError("quota", "Provider reports an exhausted billing quota.", {
      httpStatus: status,
      provider,
    });
  }

  if (status === 429) {
    const quota = QUOTA_MARKERS.some((marker) => text.includes(marker));
    if (quota) {
      return new AiError(
        "quota",
        "Quota exhausted for this provider — falling back.",
        { httpStatus: status, provider },
      );
    }

    const limited = RATE_LIMIT_MARKERS.some((marker) => text.includes(marker));
    return new AiError(
      "rate_limit",
      limited ? "Rate limited by the provider." : "Provider returned 429.",
      { httpStatus: status, retryAfterMs, provider },
    );
  }

  if (status === 404) {
    return new AiError(
      "unsupported",
      "Model or endpoint not found — check the configured model id.",
      { httpStatus: status, provider },
    );
  }

  if (status === 400 || status === 422) {
    return new AiError("unsupported", `Provider rejected the request (HTTP ${status}).`, {
      httpStatus: status,
      provider,
    });
  }

  if (status >= 500) {
    return new AiError("server", `Provider error (HTTP ${status}).`, {
      httpStatus: status,
      provider,
    });
  }

  return new AiError("unknown", `Request failed (HTTP ${status}).`, {
    httpStatus: status,
    provider,
  });
}

export function timeoutError(provider: AiProviderId, timeoutMs: number) {
  return new AiError("timeout", `No response within ${timeoutMs} ms.`, { provider });
}

export function networkError(provider: AiProviderId, cause: unknown) {
  return new AiError(
    "network",
    cause instanceof Error ? cause.message : "Network request failed.",
    { provider, cause },
  );
}

export function notConfiguredError(provider: AiProviderId, envKeys: string[]) {
  return new AiError(
    "not_configured",
    `${provider} is not configured. Set ${envKeys.join(", ")}.`,
    { provider },
  );
}
