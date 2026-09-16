import type { AiProviderId } from "@/types";

import { geminiProvider } from "./gemini";
import { groqProvider } from "./groq";
import { localProvider } from "./local";
import { naraProvider } from "./nara";
import { openRouterProvider } from "./openrouter";
import { AI_ENV, providerOrder, type AiProvider } from "./types";

/**
 * The provider registry. Order comes from `AI_PROVIDER_ORDER` (default:
 * gemini → groq → nara → openrouter → offline), and only configured providers are
 * eligible for the chain.
 */
export const PROVIDERS: Record<AiProviderId, AiProvider> = {
  gemini: geminiProvider,
  groq: groqProvider,
  nara: naraProvider,
  openrouter: openRouterProvider,
  local: localProvider,
};

export function listProviders(): AiProvider[] {
  return Object.values(PROVIDERS).sort((a, b) => a.priority - b.priority);
}

export function configuredProviders(): AiProvider[] {
  const order = providerOrder();
  return order.map((id) => PROVIDERS[id]).filter((provider) => provider.configured);
}

export function describeProviders() {
  const order = providerOrder();
  return order.map((id, index) => ({ ...PROVIDERS[id], priority: index }));
}

export function primaryProvider() {
  return configuredProviders()[0] ?? null;
}

export { AI_ENV, providerOrder };
export type {
  AiProvider,
  GenerateHint,
  GenerateRequest,
  GenerateResult,
  GroundedSource,
} from "./types";
