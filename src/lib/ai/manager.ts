import type { ZodType } from "zod";

import { repairPrompt } from "@/lib/prompts";
import { appendLog } from "@/lib/repositories/ai-logs-repository";
import type { AiErrorKind, AiStepId, AiUsage } from "@/types";

import { AiError } from "./errors";
import { describeIssues, normaliseShape, parseModelJson } from "./json";
import { AI_ENV, configuredProviders, type AiProvider, type GenerateHint } from "./providers";
import type { GroundedSource } from "./providers/types";
import type { PromptPair } from "@/lib/prompts";

/**
 * The AI manager.
 *
 * Responsibilities, in order:
 *   1. Walk the configured provider chain — Gemini, then Groq, then OpenRouter.
 *   2. Retry transient failures with exponential backoff and jitter, honouring
 *      `Retry-After` when a provider sends one.
 *   3. Repair malformed JSON: deterministically first, then with one model-backed
 *      repair call against the same provider.
 *   4. Validate every result with Zod before anyone else sees it.
 *   5. Log every request and response, successful or not.
 *
 * A provider that is out of quota or rejecting the key is abandoned immediately
 * (no point burning the retry budget), while timeouts, 429s and 5xx are retried.
 */

const SCHEMA_VERSION = 1;

export interface RunStepOptions<T> {
  step: AiStepId | "repair";
  /** The Zod contract this step must satisfy. */
  schema: ZodType<T>;
  prompt: PromptPair;
  hint: GenerateHint;
  jobId: string | null;
  grounding?: boolean;
  maxOutputTokens?: number;
  /** The JSON contract text handed to the repair call. */
  contract: string;
  signal?: AbortSignal;
  /**
   * Absolute wall-clock ceiling for the run this step belongs to.
   *
   * Nine sequential model calls at one or two minutes each can outlive any
   * sensible ceiling, so the run carries one deadline and each step spends only
   * what is left of it. Without this a run has no upper bound at all: it will
   * keep retrying through the provider chain until something else kills it, and
   * that "something else" used to be the browser giving up on a run that was
   * still working.
   */
  deadlineAt?: number;
}

/** Never hand a provider a timeout so short that a healthy request cannot land. */
const MIN_STEP_TIMEOUT_MS = 20_000;

/**
 * How long one attempt may take, given the run's remaining budget.
 *
 * Exported because the rule is worth testing on its own: it decides whether a
 * step gets a full timeout, a shortened one, or is refused for lack of budget.
 */
export function attemptTimeoutMs(input: {
  deadlineAt?: number;
  now: number;
  defaultTimeoutMs: number;
}): number | null {
  if (input.deadlineAt === undefined) return input.defaultTimeoutMs;

  const remaining = input.deadlineAt - input.now;
  if (remaining <= MIN_STEP_TIMEOUT_MS) return null;

  return Math.min(input.defaultTimeoutMs, remaining);
}

export interface RunStepResult<T> {
  value: T;
  provider: AiProvider;
  attempts: number;
  latencyMs: number;
  repairs: string[];
  grounded: boolean;
  sources: GroundedSource[];
  usage: AiUsage | null;
}

function toAiError(error: unknown, provider: AiProvider): AiError {
  if (error instanceof AiError) {
    return error.provider === null
      ? new AiError(error.kind, error.message, {
          httpStatus: error.httpStatus,
          retryAfterMs: error.retryAfterMs,
          provider: provider.id,
          cause: error,
        })
      : error;
  }

  if (error instanceof SyntaxError) {
    return new AiError("invalid_json", error.message, { provider: provider.id });
  }

  return new AiError(
    "unknown",
    error instanceof Error ? error.message : String(error),
    { provider: provider.id, cause: error },
  );
}

/** Exponential backoff with ±20% jitter, capped, and never shorter than Retry-After. */
export function backoffDelay(attempt: number, retryAfterMs: number | null) {
  const exponential = Math.min(
    AI_ENV.backoffBaseMs * 2 ** (attempt - 1),
    AI_ENV.backoffMaxMs,
  );
  const jittered = exponential * (0.8 + Math.random() * 0.4);
  const target = Math.max(jittered, retryAfterMs ?? 0);
  return Math.round(Math.min(target, AI_ENV.backoffMaxMs * 2));
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

/** Logs one attempt, whichever way it went. */
async function record(input: {
  jobId: string | null;
  step: AiStepId | "repair";
  provider: AiProvider;
  attempt: number;
  latencyMs: number;
  prompt: PromptPair;
  jsonMode: boolean;
  grounding: boolean;
  text: string | null;
  parsed: unknown | null;
  error: AiError | null;
  usage: AiUsage | null;
  repairs: string[];
}) {
  await appendLog({
    jobId: input.jobId,
    step: input.step,
    provider: input.provider.id,
    model: input.provider.model,
    status: input.error ? "error" : "success",
    attempt: input.attempt,
    latencyMs: input.latencyMs,
    request: {
      system: input.prompt.system,
      user: input.prompt.user,
      jsonMode: input.jsonMode,
      options: { grounding: input.grounding, schemaVersion: SCHEMA_VERSION },
    },
    response:
      input.text === null
        ? null
        : {
            text: input.text,
            // Storing the parsed payload only makes sense when it is valid.
            parsed: input.parsed,
          },
    error: input.error ? input.error.toLog() : null,
    usage: input.usage,
    repairs: input.repairs,
  });
}

/** Deterministic repairs, then one model-backed repair call, then give up. */
async function repairWithModel<T>(
  provider: AiProvider,
  input: {
    jobId: string | null;
    step: AiStepId | "repair";
    contract: string;
    broken: string;
    problem: string;
    schema: RunStepOptions<T>["schema"];
    hint: GenerateHint;
    signal?: AbortSignal;
  },
): Promise<{ value: T; repairs: string[]; latencyMs: number } | null> {
  if (AI_ENV.repairAttempts < 1) return null;

  const prompt = repairPrompt({
    broken: input.broken,
    contract: input.contract,
    problem: input.problem,
  });

  const started = Date.now();

  try {
    const result = await provider.generate({
      system: prompt.system,
      user: prompt.user,
      jsonMode: true,
      timeoutMs: AI_ENV.timeoutMs,
      maxOutputTokens: 8192,
      hint: input.hint,
    });

    const { value, repairs } = parseModelJson(result.text);
    const normalised = normaliseShape(value);
    const parsed = input.schema.safeParse(normalised.value);

    if (!parsed.success) {
      await record({
        jobId: input.jobId,
        step: "repair",
        provider,
        attempt: 1,
        latencyMs: Date.now() - started,
        prompt,
        jsonMode: true,
        grounding: false,
        text: result.text,
        parsed: null,
        usage: result.usage,
        error: new AiError("schema", describeIssues(parsed.error.issues), {
          provider: provider.id,
        }),
        repairs,
      });
      return null;
    }

    await record({
      jobId: input.jobId,
      step: "repair",
      provider,
      attempt: 1,
      latencyMs: Date.now() - started,
      prompt,
      jsonMode: true,
      grounding: false,
      text: result.text,
      parsed: parsed.data as unknown,
      usage: result.usage,
      error: null,
      repairs: ["model-backed repair", ...repairs],
    });

    return {
      value: parsed.data,
      repairs: ["model-backed repair", ...repairs],
      latencyMs: Date.now() - started,
    };
  } catch (error) {
    await record({
      jobId: input.jobId,
      step: "repair",
      provider,
      attempt: 1,
      latencyMs: Date.now() - started,
      prompt,
      jsonMode: true,
      grounding: false,
      text: null,
      parsed: null,
      usage: null,
      error: toAiError(error, provider),
      repairs: [],
    });
    return null;
  }
}

export async function runStep<T>(options: RunStepOptions<T>): Promise<RunStepResult<T>> {
  const providers = configuredProviders();

  if (providers.length === 0) {
    throw new AiError(
      "not_configured",
      "No AI provider is configured. Set GEMINI_API_KEY (primary), or GROQ_API_KEY / OPENROUTER_API_KEY as fallbacks.",
    );
  }

  const { step, prompt, hint, schema, contract } = options;
  const jsonMode = true;
  const grounding = options.grounding === true;
  const maxOutputTokens = options.maxOutputTokens ?? 8192;

  // Out of budget before the first attempt: fail now, with the reason, rather
  // than start a request there is no time to finish.
  if (attemptTimeoutMs({ deadlineAt: options.deadlineAt, now: Date.now(), defaultTimeoutMs: AI_ENV.timeoutMs }) === null) {
    throw new AiError(
      "timeout",
      `Ran out of the run's time budget before the "${step}" step could start.`,
    );
  }

  let lastError: AiError | null = null;
  let totalAttempts = 0;
  let totalLatency = 0;
  let lastProvider: AiProvider = providers[0];

  for (const provider of providers) {
    lastProvider = provider;

    for (let attempt = 1; attempt <= AI_ENV.maxAttempts; attempt += 1) {
      totalAttempts += 1;
      const started = Date.now();

      // Recomputed per attempt: a retry after a long backoff gets what is left,
      // not another full timeout window.
      const timeoutMs = attemptTimeoutMs({
        deadlineAt: options.deadlineAt,
        now: Date.now(),
        defaultTimeoutMs: AI_ENV.timeoutMs,
      });

      // The budget is shared by every provider, so once it is gone there is
      // nothing to gain by moving down the chain. Fail the step with the reason.
      if (timeoutMs === null) {
        throw new AiError(
          "timeout",
          `Ran out of the run's time budget during the "${step}" step.`,
        );
      }

      try {
        const result = await provider.generate({
          system: prompt.system,
          user: prompt.user,
          jsonMode,
          timeoutMs,
          maxOutputTokens,
          grounding,
          hint,
        });

        const latencyMs = Date.now() - started;
        totalLatency += latencyMs;
        const repairs: string[] = [];

        let parsedValue: unknown;
        try {
          const parsed = parseModelJson(result.text);
          parsedValue = parsed.value;
          repairs.push(...parsed.repairs);
        } catch (error) {
          // Unparseable even after deterministic fixes: ask the model to fix it.
          const repaired = await repairWithModel<T>(provider, {
            jobId: options.jobId,
            step,
            contract,
            broken: result.text,
            problem:
              error instanceof Error ? error.message : "The response is not valid JSON.",
            schema,
            hint,
            signal: options.signal,
          });

          if (repaired) {
            await record({
              jobId: options.jobId,
              step,
              provider,
              attempt,
              latencyMs,
              prompt,
              jsonMode,
              grounding,
              text: result.text,
              parsed: null,
              usage: result.usage,
              error: new AiError("invalid_json", "Recovered by the repair pass.", {
                provider: provider.id,
              }),
              repairs,
            });

            return {
              value: repaired.value,
              provider,
              attempts: totalAttempts,
              latencyMs: totalLatency + repaired.latencyMs,
              repairs: [...repairs, ...repaired.repairs],
              grounded: result.grounded,
              sources: result.sources,
              usage: result.usage,
            };
          }

          throw new AiError(
            "invalid_json",
            error instanceof Error ? error.message : "Unparseable model output.",
            { provider: provider.id },
          );
        }

        const normalised = normaliseShape(parsedValue);
        repairs.push(...normalised.repairs);

        const validated = schema.safeParse(normalised.value);

        if (!validated.success) {
          const problem = describeIssues(validated.error.issues);

          const repaired = await repairWithModel<T>(provider, {
            jobId: options.jobId,
            step,
            contract,
            broken: JSON.stringify(normalised.value).slice(0, 12_000),
            problem: `Schema validation failed — ${problem}`,
            schema,
            hint,
            signal: options.signal,
          });

          if (repaired) {
            await record({
              jobId: options.jobId,
              step,
              provider,
              attempt,
              latencyMs,
              prompt,
              jsonMode,
              grounding,
              text: result.text,
              parsed: normalised.value,
              usage: result.usage,
              error: new AiError("schema", `Recovered — ${problem}`, {
                provider: provider.id,
              }),
              repairs,
            });

            return {
              value: repaired.value,
              provider,
              attempts: totalAttempts,
              latencyMs: totalLatency + repaired.latencyMs,
              repairs: [...repairs, ...repaired.repairs],
              grounded: result.grounded,
              sources: result.sources,
              usage: result.usage,
            };
          }

          throw new AiError("schema", `Schema validation failed — ${problem}`, {
            provider: provider.id,
          });
        }

        await record({
          jobId: options.jobId,
          step,
          provider,
          attempt,
          latencyMs,
          prompt,
          jsonMode,
          grounding,
          text: result.text,
          parsed: validated.data as unknown,
          usage: result.usage,
          error: null,
          repairs,
        });

        return {
          value: validated.data,
          provider,
          attempts: totalAttempts,
          latencyMs,
          repairs,
          grounded: result.grounded,
          sources: result.sources,
          usage: result.usage,
        };
      } catch (error) {
        const aiError = toAiError(error, provider);
        lastError = aiError;

        const latencyMs = Date.now() - started;
        totalLatency += latencyMs;

        await record({
          jobId: options.jobId,
          step,
          provider,
          attempt,
          latencyMs,
          prompt,
          jsonMode,
          grounding,
          text: null,
          parsed: null,
          usage: null,
          error: aiError,
          repairs: [],
        });

        if (aiError.providerFatal) break; // switch provider immediately
        if (!aiError.retryable || attempt === AI_ENV.maxAttempts) break;

        await sleep(backoffDelay(attempt, aiError.retryAfterMs));
      }
    }
  }

  const kind: AiErrorKind = lastError?.kind ?? "unknown";
  throw new AiError(
    kind,
    `All ${providers.length} provider(s) failed for the "${step}" step. Last error: ${
      lastError?.message ?? "unknown"
    }`,
    { provider: lastProvider.id, cause: lastError },
  );
}
