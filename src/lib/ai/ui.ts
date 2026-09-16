import type { AiErrorKind, AiLogStep, AiProviderId } from "@/types";

/**
 * Presentation-only AI vocabulary.
 *
 * Kept separate from the engine modules so client components can label a log
 * entry without importing anything that touches `node:fs` or `node:crypto`.
 */

export const AI_STEP_LABELS: Record<AiLogStep, string> = {
  topic: "Pick topic",
  research: "Research",
  verify: "Verify facts",
  carousel: "Carousel",
  caption: "Caption",
  hashtags: "Hashtags",
  alt_text: "Alt text",
  quality: "Quality score",
  repair: "JSON repair",
  test: "Provider test",
};

export const AI_PROVIDER_LABELS: Record<AiProviderId, string> = {
  gemini: "Gemini",
  groq: "Groq",
  openrouter: "OpenRouter",
  local: "Local fallback",
};

/** What each failure kind means and what a human should do about it. */
export const AI_ERROR_LABELS: Record<AiErrorKind, string> = {
  quota: "Quota exhausted — fell through to the next provider",
  rate_limit: "Rate limited — retried with backoff",
  timeout: "Timed out — retried with backoff",
  auth: "Key rejected by the provider",
  network: "Network unreachable",
  server: "Provider returned a server error",
  invalid_json: "Model returned unusable JSON",
  schema: "Payload did not match the schema",
  not_configured: "No API key configured",
  unsupported: "Provider does not support this request",
  unknown: "Unclassified failure",
};

export function formatLatency(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/** Tokens are only known when the provider reports usage. */
export function formatTokens(total: number | null | undefined) {
  if (total === null || total === undefined) return "—";
  if (total < 1000) return String(total);
  return `${(total / 1000).toFixed(1)}k`;
}
