import { NextResponse } from "next/server";

import { appBaseUrl, serverEnv } from "@/lib/env";
import { safeEqual } from "@/lib/security/crypto";

/**
 * Authentication for the endpoints that can be reached without a browser.
 *
 * These routes are how the outside world acts on the workspace: the scheduler
 * tick publishes to Instagram, the learning run rewrites the weights the
 * generation engine follows, and the Telegram callback approves and rejects
 * real content. Three separate copies of "read the env var, compare the header"
 * used to guard them, and all three shared the same flaw — the comparison used
 * `!==`, which short-circuits on the first differing byte, and the endpoint was
 * left wide open whenever the secret happened to be unset.
 *
 * Both are fixed here, once:
 *
 *  - comparison is constant-time (`safeEqual`);
 *  - an unset secret is a refusal in production, not an open door. Running with
 *    no secret is a development convenience, and the deployment that forgot to
 *    set one is precisely the one that needs protecting.
 *
 * **What this does not do.** There is no user authentication anywhere in this
 * app. Any request that reaches the other routes — approving a post, deleting
 * it, connecting an Instagram account — is accepted from anyone who knows the
 * URL. These guards protect the machine-facing endpoints; they do not make the
 * workspace private. See the deployment guide: put an access gate in front of
 * the deployment before it handles a real account.
 */

export type GuardFailure = NextResponse;

/** True when the request carries no `Origin` header at all (a server call). */
function hasNoOrigin(request: Request): boolean {
  return request.headers.get("origin") === null;
}

/**
 * Whether a request appears to come from this app's own pages.
 *
 * The dashboard buttons call the same endpoints the cron does, and they cannot
 * carry a shared secret — anything in the browser is public. A same-origin
 * `Origin` identifies the call as coming from a page this app served, which is
 * what keeps the buttons working without handing the secret to the client.
 *
 * This is a CSRF control, not an authentication one: it stops another site from
 * driving the endpoint on a visitor's behalf. It does not distinguish one
 * visitor from another, because the app has no concept of a visitor yet.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  const expected = appBaseUrl();
  try {
    return new URL(origin).origin === new URL(expected).origin;
  } catch {
    return false;
  }
}

interface SecretCheckOptions {
  /** Header the caller may present the secret in. */
  header: string;
  /** Name used in the refusal message, so the fix is obvious. */
  name: string;
  /** Whether a browser call from this app's own pages is acceptable. */
  allowSameOrigin: boolean;
}

function checkSecret(
  request: Request,
  secret: string | undefined,
  options: SecretCheckOptions,
): GuardFailure | null {
  const provided =
    request.headers.get(options.header) ??
    // Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`; the GitHub
    // Actions workflow sends the named header. Accepting both means one
    // deployment can be driven by either clock.
    bearerToken(request);

  if (!secret) {
    // Development may run without a secret; production may not.
    if (serverEnv().NODE_ENV !== "production") return null;

    return NextResponse.json(
      {
        error: `${options.name} is not configured`,
        detail:
          `Set ${options.name} in the environment. This endpoint can trigger ` +
          "real side effects, so it refuses to run unauthenticated in production.",
      },
      { status: 503 },
    );
  }

  if (provided && safeEqual(provided, secret)) return null;
  if (options.allowSameOrigin && isSameOrigin(request)) return null;

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1] : null;
}

/**
 * Guards `/api/schedule/process` and `/api/learning/run`.
 *
 * Both write state the pipeline acts on, so both accept the scheduler secret,
 * the Vercel cron secret, or a same-origin call from the dashboard.
 */
export function guardScheduler(request: Request): GuardFailure | null {
  const env = serverEnv();

  const secret = env.SCHEDULER_SECRET ?? env.CRON_SECRET;
  if (secret) {
    return checkSecret(request, secret, {
      header: "x-scheduler-secret",
      name: "SCHEDULER_SECRET",
      allowSameOrigin: true,
    });
  }

  // Neither is set. `checkSecret` decides whether that is acceptable here.
  return checkSecret(request, undefined, {
    header: "x-scheduler-secret",
    name: "SCHEDULER_SECRET",
    allowSameOrigin: true,
  });
}

/**
 * Guards `/api/telegram/callback`.
 *
 * Always requires the secret: Telegram is configured with it when the webhook
 * is registered, so there is no need to tolerate a missing one, and an
 * unauthenticated endpoint that approves content is worse than no
 * notifications at all. Same-origin calls are not accepted — Telegram is a
 * server, never a page of ours.
 */
export function guardTelegramWebhook(request: Request): GuardFailure | null {
  const secret = serverEnv().TELEGRAM_WEBHOOK_SECRET;

  if (!secret) {
    return NextResponse.json(
      {
        error: "TELEGRAM_WEBHOOK_SECRET is not configured",
        detail:
          "This endpoint approves and rejects real content. Set the secret and " +
          "register it with Telegram via setWebhook.",
      },
      { status: 503 },
    );
  }

  return checkSecret(request, secret, {
    header: "x-telegram-bot-api-secret-token",
    name: "TELEGRAM_WEBHOOK_SECRET",
    allowSameOrigin: false,
  });
}

export { hasNoOrigin };
