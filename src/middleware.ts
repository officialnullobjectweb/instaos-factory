import { NextResponse, type NextRequest } from "next/server";

/**
 * Edge middleware: cross-site mutation protection and baseline headers.
 *
 * **CSRF.** The app has no sessions or cookies, so classic CSRF (a victim's
 * browser replaying an authenticated cookie) does not apply. What does apply
 * is cross-site *form and fetch* posts: any website can make a visitor's
 * browser POST to these endpoints. The per-route guards in
 * `lib/security/guards.ts` protect the three machine-facing routes; this
 * middleware gives the remaining mutating routes the same rule uniformly:
 *
 *   a mutation carrying an `Origin` header must originate from this app.
 *
 * Requests without an `Origin` (curl, server-to-server, same-origin fetches
 * from some browsers) pass through — that is what keeps the GitHub Actions
 * scripts and the Telegram webhook working without special-casing them here.
 * The per-route secret guards stay in place and add authentication on top;
 * this layer is only the cross-site check, so the two never disagree.
 *
 * **Headers.** The baseline set browsers should have on every response:
 * no MIME sniffing, no framing, no referrer leakage on cross-origin
 * navigations. Cheap to add here once instead of auditing every route.
 */

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function middleware(request: NextRequest) {
  if (UNSAFE_METHODS.has(request.method)) {
    const origin = request.headers.get("origin");

    if (origin) {
      let allowed: boolean;
      try {
        allowed = new URL(origin).origin === new URL(request.url).origin;
      } catch {
        allowed = false;
      }

      if (!allowed) {
        return NextResponse.json(
          {
            error: "Cross-site request refused",
            detail:
              "This endpoint accepts mutations only from the app's own origin.",
          },
          { status: 403 },
        );
      }
    }
  }

  const response = NextResponse.next();
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  return response;
}

export const config = {
  // Page routes and API routes alike; the matcher excludes static files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
