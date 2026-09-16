"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Route-section error boundary.
 *
 * A thrown error in any workspace page previously replaced the whole app with
 * Next's default screen — unstyled, with the production message stripped down
 * to nothing useful. This boundary keeps the shell (sidebar, topbar) alive,
 * explains what happened in plain language, and offers the one action that
 * usually helps: a fresh render of the failed section.
 *
 * `reset` remounts the segment without a full page load, so client-side state
 * elsewhere (queue filters, the command palette) survives the recovery.
 */
export default function WorkspaceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-6 text-center"
    >
      <div className="flex size-12 items-center justify-center rounded-2xl border border-danger/25 bg-danger/10">
        <TriangleAlert className="size-5 text-danger" aria-hidden="true" />
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-ink">This section failed to load</h2>
        <p className="max-w-md text-sm leading-relaxed text-ink-2">
          Something went wrong while rendering this page. Your data is safe —
          the failure was in the view, not the store. Retrying re-renders just
          this section.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={reset} variant="primary">
          <RotateCcw className="size-4" aria-hidden="true" />
          Try again
        </Button>
        <Button onClick={() => window.location.reload()} variant="secondary">
          Reload the app
        </Button>
      </div>

      {error.digest ? (
        <p className="font-mono text-xs text-ink-3">
          Reference: {error.digest}
        </p>
      ) : null}
    </div>
  );
}
