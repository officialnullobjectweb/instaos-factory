import { bearer, chatCompletion } from "./openai-compatible";
import { AI_ENV, type AiProvider, type GenerateRequest, type GenerateResult } from "./types";

/**
 * OpenRouter — last hosted fallback.
 *
 * OpenRouter proxies whichever model is configured, so the model id is pure
 * configuration. When a step asks for grounding we append the documented
 * `:online` suffix, which attaches OpenRouter's web plugin; if the plan does not
 * include it the request still succeeds without citations.
 */
export const openRouterProvider: AiProvider = {
  id: "openrouter",
  label: "OpenRouter",
  model: AI_ENV.openrouter.model,
  configured: AI_ENV.openrouter.apiKey !== "",
  priority: 2,
  roles: ["fallback"],
  envKeys: AI_ENV.openrouter.keys,
  supportsGrounding: true,
  note: "Last fallback. Model-agnostic; grounding available via the :online suffix.",

  async generate(request: GenerateRequest): Promise<GenerateResult> {
    const model = request.grounding ? `${AI_ENV.openrouter.model}:online` : AI_ENV.openrouter.model;

    const result = await chatCompletion({
      id: "openrouter",
      url: `${AI_ENV.openrouter.baseUrl}/chat/completions`,
      model,
      headers: {
        ...bearer(AI_ENV.openrouter.apiKey),
        "HTTP-Referer": AI_ENV.openrouter.referer,
        "X-Title": AI_ENV.openrouter.title,
      },
      request,
    });

    return result;
  },
};
