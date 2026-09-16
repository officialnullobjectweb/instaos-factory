import { serverEnv } from "@/lib/env";
import type {
  AiProviderDescriptor,
  AiProviderId,
  AiStepId,
  AiUsage,
  BrandId,
  PostCategory,
} from "@/types";

/**
 * Context a provider may use beyond the prompt text. Hosted providers ignore it;
 * the offline engine needs it to stay coherent about which step it is serving.
 */
export interface GenerateHint {
  step: AiStepId;
  brandId: BrandId;
  topic?: string;
  /** Verified claims, so downstream steps can reference the same material. */
  facts?: string[];
  /** True when the flow is running each compose step as its own call. */
  granular?: boolean;
  /** Titles already published — the offline engine filters these out. */
  avoid?: string[];
}

/** One model call, provider-agnostic. */
export interface GenerateRequest {
  system: string;
  user: string;
  /** Ask the provider for a JSON-only response where it supports that. */
  jsonMode: boolean;
  timeoutMs: number;
  maxOutputTokens: number;
  /**
   * Allow the provider to ground the answer in live search results. Providers
   * that cannot will ignore it and report `grounded: false`.
   */
  grounding?: boolean;
  hint?: GenerateHint;
}

export interface GroundedSource {
  title: string;
  url: string;
  publisher: string | null;
}

export interface GenerateResult {
  text: string;
  model: string;
  usage: AiUsage | null;
  grounded: boolean;
  sources: GroundedSource[];
}

export interface AiProvider extends AiProviderDescriptor {
  generate(request: GenerateRequest): Promise<GenerateResult>;
}

/* -------------------------------------------------------------------------- */
/*  Environment                                                               */
/* -------------------------------------------------------------------------- */

/**
 * The provider view of the environment.
 *
 * Every value is read from the validated schema in `lib/env.ts` rather than
 * `process.env` directly, so there is exactly one place that decides what a
 * malformed variable means. Parsing here would be a second opinion on the same
 * data, and the two would eventually disagree.
 *
 * Defaults are current production models rather than previews.
 */
export const AI_ENV = {
  gemini: {
    get apiKey() {
      return serverEnv().GEMINI_API_KEY ?? "";
    },
    get model() {
      return serverEnv().GEMINI_MODEL;
    },
    get baseUrl() {
      return serverEnv().GEMINI_BASE_URL;
    },
    keys: ["GEMINI_API_KEY", "GEMINI_MODEL"],
  },
  groq: {
    get apiKey() {
      return serverEnv().GROQ_API_KEY ?? "";
    },
    get model() {
      return serverEnv().GROQ_MODEL;
    },
    get baseUrl() {
      return serverEnv().GROQ_BASE_URL;
    },
    keys: ["GROQ_API_KEY", "GROQ_MODEL"],
  },
  openrouter: {
    get apiKey() {
      return serverEnv().OPENROUTER_API_KEY ?? "";
    },
    get model() {
      return serverEnv().OPENROUTER_MODEL;
    },
    get baseUrl() {
      return serverEnv().OPENROUTER_BASE_URL;
    },
    keys: ["OPENROUTER_API_KEY", "OPENROUTER_MODEL"],
    /** Sent to OpenRouter for attribution; harmless when unset. */
    get referer() {
      return serverEnv().OPENROUTER_REFERER;
    },
    get title() {
      return serverEnv().OPENROUTER_TITLE;
    },
  },
  local: {
    get enabled() {
      return serverEnv().AI_ENABLE_LOCAL_PROVIDER;
    },
    get model() {
      return serverEnv().AI_LOCAL_MODEL;
    },
    keys: ["AI_ENABLE_LOCAL_PROVIDER"],
  },
  get timeoutMs() {
    return serverEnv().AI_REQUEST_TIMEOUT_MS;
  },
  get maxAttempts() {
    return serverEnv().AI_MAX_ATTEMPTS;
  },
  get repairAttempts() {
    return serverEnv().AI_MAX_REPAIR_ATTEMPTS;
  },
  get backoffBaseMs() {
    return serverEnv().AI_BACKOFF_BASE_MS;
  },
  get backoffMaxMs() {
    return serverEnv().AI_BACKOFF_MAX_MS;
  },
  /** Run carousel/caption/hashtags/alt/quality as five calls instead of one. */
  get granularSteps() {
    return serverEnv().AI_GRANULAR_STEPS;
  },
} as const;

/** Provider order for the fallback chain, overridable for testing. */
export function providerOrder(): AiProviderId[] {
  const configured = serverEnv()
    .AI_PROVIDER_ORDER.map((entry) => entry.toLowerCase())
    .filter((entry): entry is AiProviderId =>
      ["gemini", "groq", "openrouter", "local"].includes(entry),
    );

  const defaultOrder: AiProviderId[] = ["gemini", "groq", "openrouter", "local"];

  if (!configured || configured.length === 0) return defaultOrder;

  // Keep any provider the operator forgot to list at the end rather than
  // silently dropping it from the chain.
  return [
    ...configured.filter((id) => defaultOrder.includes(id)),
    ...defaultOrder.filter((id) => !configured.includes(id)),
  ];
}

/** Everything the flow needs to describe a generation request. */
export interface GenerationBrief {
  brandId: BrandId;
  category: PostCategory;
  steer?: string;
  avoid?: string[];
  granular: boolean;
}
