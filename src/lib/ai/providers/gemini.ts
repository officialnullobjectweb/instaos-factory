import { AiError } from "../errors";
import { postJson } from "./http";
import { AI_ENV, type AiProvider, type GenerateRequest, type GenerateResult } from "./types";

/**
 * Google Gemini — the primary provider.
 *
 * Two details worth knowing:
 * - `temperature`, `top_p` and `top_k` are deprecated on current Gemini models,
 *   so the request sends no sampling parameters at all and relies on the
 *   defaults Google now tunes for instruction following.
 * - Research benefits from real grounding, so that step asks for the Google
 *   Search tool. If the account or model rejects the tool, the call is retried
 *   once without it rather than failing the whole job.
 */

interface GeminiPart {
  text?: string;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: GeminiPart[] };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
  groundingMetadata?: {
    groundingChunks?: Array<{ web?: { uri?: string; title?: string; domain?: string } }>;
  };
}

function buildBody(request: GenerateRequest, grounding: boolean) {
  return {
    systemInstruction: { parts: [{ text: request.system }] },
    contents: [{ role: "user", parts: [{ text: request.user }] }],
    generationConfig: {
      responseMimeType: request.jsonMode ? "application/json" : "text/plain",
      maxOutputTokens: request.maxOutputTokens,
    },
    ...(grounding ? { tools: [{ google_search: {} }] } : {}),
  };
}

function extract(result: GeminiResponse) {
  const candidate = result.candidates?.[0];
  const text = (candidate?.content?.parts ?? [])
    .map((part) => part.text ?? "")
    .join("")
    .trim();

  if (!text) {
    const blocked = result.promptFeedback?.blockReason;
    if (blocked) {
      throw new AiError("unsupported", `Gemini blocked the response (${blocked}).`);
    }
    throw new AiError(
      "server",
      `Gemini returned no text (finish reason: ${candidate?.finishReason ?? "unknown"}).`,
    );
  }

  const sources = (result.groundingMetadata?.groundingChunks ?? [])
    .map((chunk) => ({
      title: chunk.web?.title ?? "",
      url: chunk.web?.uri ?? "",
      publisher: chunk.web?.domain ?? null,
    }))
    .filter((source) => source.url !== "");

  return { text, sources };
}

export const geminiProvider: AiProvider = {
  id: "gemini",
  label: "Google Gemini",
  model: AI_ENV.gemini.model,
  configured: AI_ENV.gemini.apiKey !== "",
  priority: 0,
  roles: ["primary"],
  envKeys: AI_ENV.gemini.keys,
  supportsGrounding: true,
  note: "Primary provider. Grounded research through the Google Search tool.",

  async generate(request: GenerateRequest): Promise<GenerateResult> {
    const wantsGrounding = request.grounding === true;
    const url = `${AI_ENV.gemini.baseUrl}/models/${AI_ENV.gemini.model}:generateContent`;
    const headers = { "x-goog-api-key": AI_ENV.gemini.apiKey };

    const send = (grounding: boolean) =>
      postJson<GeminiResponse>({
        url,
        provider: "gemini",
        headers,
        body: buildBody(request, grounding),
        timeoutMs: request.timeoutMs,
      });

    let groundingApplied = wantsGrounding;

    const response = await send(wantsGrounding).catch(async (error: unknown) => {
      // Losing grounding is acceptable; losing the call is not.
      const toolRejected =
        error instanceof AiError &&
        (error.kind === "unsupported" || error.kind === "unknown") &&
        wantsGrounding;

      if (!toolRejected) throw error;

      groundingApplied = false;
      return send(false);
    });

    if (!response.json) {
      throw new AiError("invalid_json", "Gemini returned a non-JSON response body.");
    }

    const { text, sources } = extract(response.json);
    const usage = response.json.usageMetadata;

    return {
      text,
      model: AI_ENV.gemini.model,
      grounded: groundingApplied && sources.length > 0,
      sources,
      usage: usage
        ? {
            inputTokens: usage.promptTokenCount ?? null,
            outputTokens: usage.candidatesTokenCount ?? null,
            totalTokens: usage.totalTokenCount ?? null,
          }
        : null,
    };
  },
};
