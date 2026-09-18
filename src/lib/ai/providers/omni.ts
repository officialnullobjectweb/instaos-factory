import type { AiProvider, GenerateRequest, GenerateResult } from "./types";
import { AI_ENV } from "./types";

/**
 * OmniRoute provider — routes through the local OmniRoute gateway.
 * Supports multiple backends (NARA, Groq, Gemini, etc.) via auto-routing.
 */
export const omniProvider: AiProvider = {
  id: "omni",
  label: "OmniRoute",
  configured: Boolean(AI_ENV.omni.baseUrl),
  priority: 0,
  roles: ["primary", "fallback"],
  envKeys: ["OMNIROUTE_BASE_URL", "OMNIROUTE_API_KEY", "OMNIROUTE_MODEL"],
  supportsGrounding: false,
  note: "Routes through local OmniRoute gateway for multi-provider auto-routing",

  get model() {
    return AI_ENV.omni.model;
  },

  async generate(request: GenerateRequest): Promise<GenerateResult> {
    const baseUrl = AI_ENV.omni.baseUrl;
    const apiKey = AI_ENV.omni.apiKey;

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: "system", content: request.system },
          { role: "user", content: request.user },
        ],
        temperature: 0.7,
        max_tokens: 4096,
        response_format: request.jsonMode ? { type: "json_object" } : undefined,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OmniRoute error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? "";

    return {
      text: content,
      model: data.model ?? this.model,
      usage: {
        inputTokens: data.usage?.prompt_tokens ?? null,
        outputTokens: data.usage?.completion_tokens ?? null,
        totalTokens: data.usage?.total_tokens ?? null,
      },
      grounded: false,
      sources: [],
    };
  },
};
