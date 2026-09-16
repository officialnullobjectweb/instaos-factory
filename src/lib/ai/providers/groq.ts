import { bearer, chatCompletion } from "./openai-compatible";
import { AI_ENV, type AiProvider, type GenerateRequest, type GenerateResult } from "./types";

/**
 * Groq — first fallback.
 *
 * Fast and cheap, which makes it a good second attempt when Gemini is out of
 * quota. It has no search grounding, so the research step produces unverified
 * material and the verifier marks it accordingly.
 */
export const groqProvider: AiProvider = {
  id: "groq",
  label: "Groq",
  model: AI_ENV.groq.model,
  configured: AI_ENV.groq.apiKey !== "",
  priority: 1,
  roles: ["fallback"],
  envKeys: AI_ENV.groq.keys,
  supportsGrounding: false,
  note: "First fallback. Very low latency, no web grounding.",

  generate(request: GenerateRequest): Promise<GenerateResult> {
    return chatCompletion({
      id: "groq",
      url: `${AI_ENV.groq.baseUrl}/chat/completions`,
      model: AI_ENV.groq.model,
      headers: bearer(AI_ENV.groq.apiKey),
      request,
    });
  },
};
