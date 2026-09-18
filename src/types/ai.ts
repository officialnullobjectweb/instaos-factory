/* -------------------------------------------------------------------------- */
/*  Providers                                                                 */
/* -------------------------------------------------------------------------- */

export type AiProviderId = "gemini" | "groq" | "nara" | "openrouter" | "omni" | "local";

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
  | "design"
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
  /**
   * 1-based place in the waiting line, or null once the run is in flight.
   *
   * Runs beyond the concurrency limit queue rather than pile onto the same
   * provider rate limit, and this is what tells the person waiting the difference
   * between "slower than usual" and "not started yet".
   */
  queuePosition: number | null;
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

/* -------------------------------------------------------------------------- */
/*  Runs                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * How one step of a run ended.
 *
 * `warning` and `skipped` are outcomes, not decorations: a step can succeed with
 * a caveat (facts gathered without web grounding), and a stage can be genuinely
 * not applicable (the pipeline folds verification into the research call).
 * Showing either as a bare tick would misreport what the engine did.
 */
export type GenerationRunStepStatus =
  | "pending"
  | "running"
  | "success"
  | "warning"
  | "skipped"
  | "failed";

export interface GenerationRunStep {
  /** Unique within the run — a stage may legitimately be exercised twice. */
  id: string;
  /** Which pipeline stage this is, for grouping and icons. */
  step: AiStepId;
  /** What this particular call did, e.g. "Design selection". */
  label: string;
  status: GenerationRunStepStatus;
  /** The human-readable outcome, the same sentence the post's log carries. */
  message: string | null;
  /** `provider · model`, once a provider answered. */
  model: string | null;
  durationMs: number | null;
  tokens: number | null;
  /** Total provider attempts, so a fallback or a retry is visible. */
  attempts: number | null;
  startedAt: string | null;
  finishedAt: string | null;
}

export type GenerationRunStatus = "running" | "succeeded" | "failed";

/**
 * What a run already produced, so a retry can continue instead of starting over.
 *
 * The pipeline's early stages are the expensive ones — topic scoring and research
 * are the largest prompts — and they are also the most reusable: a research pass
 * that returned twelve sourced facts is still true on the second attempt. Storing
 * each stage's validated payload as it completes means a run that fails at the
 * caption step retries from the caption step, and the tokens already spent stay
 * spent rather than being spent again.
 */
/**
 * The brief a run was started with.
 *
 * Kept because a retry has to ask the same question: resuming a steered run
 * without its steer would quietly produce a different post under the same run's
 * name.
 */
export interface GenerationRunRequest {
  steer: string | null;
  owner: string | null;
}

export interface GenerationCheckpoint {
  /** Stage ids whose payload is stored, in completion order. */
  completed: AiStepId[];
  /**
   * Validated payload per stage, keyed by stage id.
   *
   * Only ever written from a `safeParse`d result, and re-validated on read: a
   * checkpoint that no longer matches its schema is ignored, not trusted, because
   * a stale payload silently fed back into the pipeline would produce a post that
   * no stage actually verified.
   */
  artifacts: Record<string, unknown>;
  savedAt: string;
}

/**
 * A complete generation attempt, persisted.
 *
 * Jobs are deliberately in-memory (a restart loses progress, not data), which
 * left a gap: a run that failed produced no post, so the failure existed only in
 * a log line nobody reads. A run is therefore stored as its own document — it is
 * the record of what the engine tried, every step it took, and exactly where and
 * why it stopped.
 */
export interface GenerationRun {
  id: string;
  jobId: string;
  brandId: BrandIdRef;
  /** The brief this run was started with, so a retry asks the same question. */
  request: GenerationRunRequest;
  status: GenerationRunStatus;
  /** The post this run produced, once it exists. */
  postId: string | null;
  /** Provider that did the most recent successful work. */
  provider: string | null;
  tokens: number;
  /** The step that failed, when `status === "failed"`. */
  failedStep: AiStepId | null;
  /** The failing step's label, kept so the reason reads without a lookup. */
  failedStepLabel: string | null;
  /** Why it stopped: the provider's own message, not a paraphrase. */
  error: string | null;
  /** Classified cause, e.g. `quota`, `timeout`, `schema`. */
  errorKind: AiErrorKind | null;
  /** The run this one continues, when it is a retry. */
  resumedFrom: string | null;
  startedAt: string;
  finishedAt: string | null;
  steps: GenerationRunStep[];
  /** Stage payloads already produced, so a retry resumes instead of restarting. */
  checkpoint: GenerationCheckpoint | null;
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
