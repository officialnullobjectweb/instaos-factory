import { bearer, chatCompletion } from "./openai-compatible";
import { AI_ENV, type AiProvider, type GenerateRequest, type GenerateResult } from "./types";

/**
 * NARA — third fallback.
 *
 * OpenAI-compatible router with free tier models.
 */
export const naraProvider: AiProvider = {
  id: "nara",
  label: "Nara",
  model: AI_ENV.nara.model,
  configured: AI_ENV.nara.apiKey !== "",
  priority: 2,
  roles: ["fallback"],
  envKeys: AI_ENV.nara.keys,
  supportsGrounding: false,
  note: "Third fallback. Free tier models available.",

  generate(request: GenerateRequest): Promise<GenerateResult> {
    return chatCompletion({
      id: "nara",
      url: `${AI_ENV.nara.baseUrl}/chat/completions`,
      model: AI_ENV.nara.model,
      headers: bearer(AI_ENV.nara.apiKey),
      request,
    });
  },
};
