import { getBrand } from "@/data/brands";
import { appBaseUrl, serverEnv } from "@/lib/env";
import { arrayDocument } from "@/lib/storage";
import type { Post, TelegramCallbackAction, TelegramStatus } from "@/types";

/**
 * Telegram control surface.
 *
 * When a post enters `pending_review`, the workspace pings the configured chat
 * with the post summary and three inline buttons: Approve, Reject and Open
 * Dashboard. Button presses arrive at `/api/telegram/callback`, which applies
 * the same state transition the dashboard would and edits the message so the
 * chat always reflects reality.
 *
 * Everything is optional: without `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`
 * the module reports unconfigured and every send is a logged no-op, so the
 * approval flow works identically without the bot.
 */

const TELEGRAM_API = "https://api.telegram.org";
const MAX_LOG = 120;

export interface TelegramSendResult {
  ok: boolean;
  skipped?: "not_configured";
  error?: string;
}

export interface TelegramLogEntry {
  at: string;
  kind: "notification" | "callback" | "error";
  postId: string | null;
  /** Short human line describing what happened. */
  detail: string;
  ok: boolean;
}

function isTelegramLogEntry(raw: unknown): raw is TelegramLogEntry {
  if (typeof raw !== "object" || raw === null) return false;
  const entry = raw as Partial<TelegramLogEntry>;
  return (
    typeof entry.at === "string" &&
    typeof entry.detail === "string" &&
    typeof entry.kind === "string"
  );
}

const telegramLog = () =>
  arrayDocument<TelegramLogEntry>({
    key: "telegram-log",
    isItem: isTelegramLogEntry,
    maxItems: MAX_LOG,
  });

/**
 * Appends to the activity log.
 *
 * Never throws: the log is a convenience for the settings screen, and a
 * notification that reached the chat but reported failure because its own log
 * line could not be written would be actively misleading.
 */
async function appendLog(entry: TelegramLogEntry): Promise<void> {
  try {
    await telegramLog().prepend(entry);
  } catch {
    // Intentionally ignored — see above.
  }
}

export async function readTelegramLog(limit = 30): Promise<TelegramLogEntry[]> {
  const entries = await telegramLog().read().catch(() => []);
  return entries.slice(0, limit);
}

export function telegramConfigured(): boolean {
  const env = serverEnv();
  return Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID);
}

export async function telegramStatus(): Promise<TelegramStatus> {
  const configured = telegramConfigured();
  const log = await readTelegramLog(1);

  return {
    configured,
    chatId: configured ? (serverEnv().TELEGRAM_CHAT_ID ?? null) : null,
    lastMessageAt: log[0]?.at ?? null,
    lastError: configured ? null : "Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID.",
  };
}

interface InlineButton {
  text: string;
  callback_data?: string;
  url?: string;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function buildPendingMessage(post: Post): string {
  const brand = getBrand(post.brandId);
  const title = escapeHtml(post.title);
  const caption = escapeHtml(post.caption.slice(0, 220));
  const score = post.quality?.score ?? "—";

  return [
    `<b>Review needed</b> — ${escapeHtml(brand.name)}`,
    "",
    `<b>${title}</b>`,
    escapeHtml(post.category) + " · quality " + score + "/100 · " + post.slides.length + " slides",
    "",
    caption + (post.caption.length > 220 ? "…" : ""),
  ].join("\n");
}

function pendingKeyboard(postId: string): InlineButton[][] {
  return [
    [
      { text: "✅ Approve", callback_data: `approve:${postId}` },
      { text: "✖ Reject", callback_data: `reject:${postId}` },
    ],
    [{ text: "🧭 Open Dashboard", url: dashboardUrl(`/queue?item=${postId}`) }],
  ];
}

function dashboardUrl(pathname: string): string {
  return `${appBaseUrl()}${pathname}`;
}

async function callTelegram(
  method: string,
  body: Record<string, unknown>,
): Promise<TelegramSendResult> {
  const { TELEGRAM_BOT_TOKEN: token, TELEGRAM_CHAT_ID: chatId } = serverEnv();
  if (!token || !chatId) return { ok: false, skipped: "not_configured" };

  try {
    const response = await fetch(`${TELEGRAM_API}/bot${token}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, ...body }),
      signal: AbortSignal.timeout(10_000),
    });

    const payload = (await response.json().catch(() => null)) as
      | { ok?: boolean; description?: string }
      | null;

    if (!response.ok || !payload?.ok) {
      return { ok: false, error: payload?.description ?? `HTTP ${response.status}` };
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "network error",
    };
  }
}

/**
 * Fires when a post becomes `pending_review` (generation, regeneration or a
 * reopened rejection). Never throws: a Telegram outage must not fail the
 * pipeline.
 */
export async function notifyPostPending(post: Post): Promise<TelegramSendResult> {
  if (!telegramConfigured()) {
    const result: TelegramSendResult = { ok: false, skipped: "not_configured" };
    await appendLog({
      at: new Date().toISOString(),
      kind: "notification",
      postId: post.id,
      detail: "Skipped — bot not configured",
      ok: false,
    });
    return result;
  }

  const result = await callTelegram("sendMessage", {
    text: buildPendingMessage(post),
    parse_mode: "HTML",
    reply_markup: { inline_keyboard: pendingKeyboard(post.id) },
    disable_web_page_preview: true,
  });

  await appendLog({
    at: new Date().toISOString(),
    kind: result.ok ? "notification" : "error",
    postId: post.id,
    detail: result.ok
      ? `Review alert sent for "${post.title}"`
      : `Send failed: ${result.error ?? "unknown error"}`,
    ok: result.ok,
  });

  return result;
}

export interface TelegramCallbackInput {
  action: TelegramCallbackAction;
  postId: string;
  /** Telegram user identity, recorded for the audit trail. */
  fromName: string;
  /** Present when answering a button press. */
  callbackQueryId?: string;
}

export async function handleCallback(
  input: TelegramCallbackInput,
): Promise<{ ok: boolean; applied: boolean; error?: string }> {
  if (input.callbackQueryId) {
    // Answer promptly so the button stops spinning regardless of the outcome.
    void callTelegram("answerCallbackQuery", {
      callback_query_id: input.callbackQueryId,
    });
  }

  const { applyTelegramDecision } = await import("@/lib/telegram/decisions");
  const outcome = await applyTelegramDecision(input.action, input.postId, {
    name: input.fromName || "Telegram",
    email: "telegram@factory.local",
  });

  await appendLog({
    at: new Date().toISOString(),
    kind: "callback",
    postId: input.postId,
    detail: `${input.action} via Telegram — ${outcome.applied ? "applied" : outcome.error ?? "not applied"}`,
    ok: outcome.applied,
  });

  return outcome;
}
