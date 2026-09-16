import { NextResponse } from "next/server";

import { AiError } from "@/lib/ai/errors";
import { parseModelJson } from "@/lib/ai/json";
import { PROVIDERS, AI_ENV } from "@/lib/ai/providers";
import { appendLog } from "@/lib/repositories/ai-logs-repository";
import type { AiProviderId } from "@/types";

export const dynamic = "force-dynamic";

const TESTABLE: AiProviderId[] = ["gemini", "groq", "openrouter", "local"];

const TEST_PROMPT = {
  system:
    "You are a connectivity probe. Reply with a single JSON object and nothing else.",
  user: 'Return exactly {"ok": true, "engine": "factory-os"}',
};

/**
 * POST /api/ai/providers/[id]/test — a real, minimal call to one provider.
 *
 * This is not a mock: it spends a token or two to prove the key works, the model
 * id exists and JSON mode is honoured. The attempt is written to the AI log
 * under the `test` step so the audit trail stays complete.
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  if (!TESTABLE.includes(id as AiProviderId)) {
    return NextResponse.json({ error: `Unknown provider "${id}"` }, { status: 404 });
  }

  const provider = PROVIDERS[id as AiProviderId];

  if (!provider.configured) {
    return NextResponse.json(
      {
        ok: false,
        error: `${provider.label} is not configured. Set ${provider.envKeys.join(", ")}.`,
        envKeys: provider.envKeys,
      },
      { status: 400 },
    );
  }

  const started = Date.now();

  try {
    const result = await provider.generate({
      ...TEST_PROMPT,
      jsonMode: true,
      timeoutMs: Math.min(AI_ENV.timeoutMs, 20_000),
      maxOutputTokens: 256,
      hint: {
        step: "topic",
        brandId: "studio-noir",
        topic: "connectivity probe",
        granular: false,
      },
    });

    const latencyMs = Date.now() - started;
    const { value, repairs } = parseModelJson(result.text);

    await appendLog({
      jobId: null,
      step: "test",
      provider: provider.id,
      model: result.model,
      status: "success",
      attempt: 1,
      latencyMs,
      request: {
        system: TEST_PROMPT.system,
        user: TEST_PROMPT.user,
        jsonMode: true,
        options: { connectivityTest: true },
      },
      response: { text: result.text, parsed: value },
      error: null,
      usage: result.usage,
      repairs,
    });

    return NextResponse.json({
      ok: true,
      provider: provider.id,
      model: result.model,
      latencyMs,
      grounded: result.grounded,
      sample: value,
    });
  } catch (error) {
    const latencyMs = Date.now() - started;
    const kind = error instanceof AiError ? error.kind : "unknown";
    const message = error instanceof Error ? error.message : String(error);

    await appendLog({
      jobId: null,
      step: "test",
      provider: provider.id,
      model: provider.model,
      status: "error",
      attempt: 1,
      latencyMs,
      request: {
        system: TEST_PROMPT.system,
        user: TEST_PROMPT.user,
        jsonMode: true,
        options: { connectivityTest: true },
      },
      response: null,
      error: {
        kind,
        message,
        httpStatus: error instanceof AiError ? error.httpStatus : null,
      },
      usage: null,
      repairs: [],
    });

    return NextResponse.json(
      { ok: false, provider: provider.id, kind, error: message, latencyMs },
      { status: 502 },
    );
  }
}
