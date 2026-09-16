import type { AiProviderId } from "@/types";

import { AiError } from "../errors";
import { postJson } from "./http";
import type { GenerateRequest, GenerateResult } from "./types";

/**
 * Groq and OpenRouter both expose the OpenAI chat-completions shape, so the
 * transport lives here once and each provider only supplies its endpoint,
 * headers and model.
 */

interface ChatCompletion {
  choices?: Array<{
    message?: { content?: string | null };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  /** OpenRouter returns citations here when the web plugin is enabled. */
  citations?: string[];
  error?: { message?: string; code?: string | number };
}

export interface OpenAiCompatibleOptions {
  id: AiProviderId;
  url: string;
  model: string;
  headers: Record<string, string>;
  request: GenerateRequest;
  /** Some hosted models reject `response_format`; we retry without it once. */
  jsonModeHint?: boolean;
}

function isJsonModeRejection(error: unknown) {
  if (!(error instanceof AiError)) return false;
  if (error.kind !== "unsupported" && error.kind !== "unknown") return false;
  return /response_format|json_object|json mode|json schema/i.test(error.message);
}

export async function chatCompletion({
  id,
  url,
  model,
  headers,
  request,
  jsonModeHint = true,
}: OpenAiCompatibleOptions): Promise<GenerateResult> {
  const send = (jsonMode: boolean) =>
    postJson<ChatCompletion>({
      url,
      provider: id,
      headers,
      body: {
        model,
        messages: [
          { role: "system", content: request.system },
          { role: "user", content: request.user },
        ],
        max_completion_tokens: request.maxOutputTokens,
        ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
      },
      timeoutMs: request.timeoutMs,
    });

  let jsonModeApplied = request.jsonMode && jsonModeHint;

  const response = await send(jsonModeApplied).catch(async (error: unknown) => {
    if (!jsonModeApplied || !isJsonModeRejection(error)) throw error;
    jsonModeApplied = false;
    return send(false);
  });

  const body = response.json;
  if (!body) {
    throw new AiError("invalid_json", `${id} returned a non-JSON response body.`);
  }

  const text = body.choices?.[0]?.message?.content?.trim() ?? "";

  if (!text) {
    throw new AiError(
      "server",
      `${id} returned no content (finish reason: ${body.choices?.[0]?.finish_reason ?? "unknown"}).`,
    );
  }

  const usage = body.usage;

  return {
    text,
    model,
    // Neither provider grounds by default; `grounding` is reported for callers
    // that only care whether the answer is source-backed.
    grounded: false,
    sources: [],
    usage: usage
      ? {
          inputTokens: usage.prompt_tokens ?? null,
          outputTokens: usage.completion_tokens ?? null,
          totalTokens: usage.total_tokens ?? null,
        }
      : null,
  };
}

export function bearer(apiKey: string) {
  return { Authorization: `Bearer ${apiKey}` };
}
