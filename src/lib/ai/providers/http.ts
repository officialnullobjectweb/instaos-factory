import type { AiProviderId } from "@/types";

import { classifyHttpFailure, networkError, timeoutError } from "../errors";

export interface PostJsonOptions {
  url: string;
  provider: AiProviderId;
  headers?: Record<string, string>;
  body: unknown;
  timeoutMs: number;
  signal?: AbortSignal;
}

export interface PostJsonResult<T> {
  status: number;
  json: T | null;
  text: string;
  headers: Headers;
}

/**
 * One place where provider HTTP happens: a hard timeout, a typed failure for
 * every non-2xx, and the raw body preserved so the AI log can show what the
 * provider actually said.
 *
 * Timeouts use `AbortController` and are re-thrown as `AiError("timeout")` so
 * the manager retries them with backoff instead of failing the whole job.
 */
export async function postJson<T>({
  url,
  provider,
  headers = {},
  body,
  timeoutMs,
  signal,
}: PostJsonOptions): Promise<PostJsonResult<T>> {
  const controller = new AbortController();
  let timedOut = false;

  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const onExternalAbort = () => controller.abort();
  signal?.addEventListener("abort", onExternalAbort, { once: true });

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
      cache: "no-store",
    });

    const text = await response.text();

    let json: T | null = null;
    if (text) {
      try {
        json = JSON.parse(text) as T;
      } catch {
        json = null;
      }
    }

    if (!response.ok) {
      throw classifyHttpFailure({
        status: response.status,
        body: json ?? text.slice(0, 2000),
        provider,
        headers: response.headers,
      });
    }

    return { status: response.status, json, text, headers: response.headers };
  } catch (error) {
    if (error instanceof Error && error.name === "AiError") throw error;
    if (timedOut) throw timeoutError(provider, timeoutMs);
    if (error instanceof Error && error.name === "AbortError") {
      throw networkError(provider, new Error("Request aborted."));
    }
    throw networkError(provider, error);
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", onExternalAbort);
  }
}
