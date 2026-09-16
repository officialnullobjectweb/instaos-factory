/* -------------------------------------------------------------------------- */
/*  Providers                                                                 */
/* -------------------------------------------------------------------------- */

export type AiProviderId = "gemini" | "groq" | "nara" | "openrouter" | "local";

/** Why an attempt failed — drives whether we retry, back off or switch provider. */
export type AiErrorKind =
  | "quota"
  | "rate_limit"
  | "timeout"
  | "auth"
  | "network"
  | "server"
  | "invalid_json"
  | "schema"
  | "not_configured"
  | "unsupported"
  | "unknown";

export interface AiUsage {
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
}

/* -------------------------------------------------------------------------- */
/*  Steps                                                                     */
/* -------------------------------------------------------------------------- */

export type AiStepId =
  | "topic"
  | "research"
  | "verify"
  | "carousel"
  | "caption"
  | "hashtags"
  | "alt_text"
  | "quality";

export type AiStepStatus = "pending" | "running" | "success" | "failed" | "skipped";

export interface AiJobStep {
  id: AiStepId;
  label: string;
  status: AiStepStatus;
  /** Human-readable outcome, e.g. "12 facts from 4 grounded sources". */
  detail: string | null;
  attempts: number;
  startedAt: string | null;
  finishedAt: string | null;
}

export type AiJobStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";

export interface AiJob {
  id: string;
  brandId: BrandIdRef;
  status: AiJobStatus;
  steps: AiJobStep[];
  /** Set once the post has been written to the queue. */
  postId: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
  finishedAt: string | null;
}

/** Local alias so this module does not import the domain barrel at runtime. */
type BrandIdRef = "midnight-ritual" | "studio-noir" | "daily-grind";

/* -------------------------------------------------------------------------- */
/*  Logs                                                                      */
/* -------------------------------------------------------------------------- */

export interface AiLogRequest {
  system: string;
  user: string;
  jsonMode: boolean;
  /** Extra provider-specific knobs that changed the request shape. */
  options?: Record<string, unknown>;
}

export interface AiLogResponse {
  text: string;
  /** Parsed JSON when the model produced something a parser accepted. */
  parsed: unknown | null;
}

export interface AiLogError {
  kind: AiErrorKind;
  message: string;
  httpStatus: number | null;
}

/** `repair` and `test` are internal calls, kept so the trail is complete. */
export type AiLogStep = AiStepId | "repair" | "test";

export interface AiLogEntry {
  id: string;
  jobId: string | null;
  step: AiLogStep;
  provider: AiProviderId;
  model: string;
  status: "success" | "error";
  /** 1-based attempt number within this provider/step. */
  attempt: number;
  latencyMs: number;
  request: AiLogRequest;
  response: AiLogResponse | null;
  error: AiLogError | null;
  usage: AiUsage | null;
  /** Repairs that were applied to make the payload parse, for transparency. */
  repairs: string[];
  createdAt: string;
}

export interface AiLogSummary {
  total: number;
  succeeded: number;
  failed: number;
  byProvider: Array<{ provider: AiProviderId; total: number; failed: number }>;
  averageLatencyMs: number;
  fallbackRate: number;
  lastFailure: string | null;
}

/* -------------------------------------------------------------------------- */
/*  Provider descriptor (what the settings page and the manager both read)     */
/* -------------------------------------------------------------------------- */

export interface AiProviderDescriptor {
  id: AiProviderId;
  label: string;
  model: string;
  configured: boolean;
  /** Order in the fallback chain, 0 first. */
  priority: number;
  roles: Array<"primary" | "fallback">;
  envKeys: readonly string[];
  /** True when the provider can ground answers against live search results. */
  supportsGrounding: boolean;
  note: string;
}
