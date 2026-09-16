import type * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Instagram glyph, drawn locally: lucide v1 removed brand marks, and the OS
 * needs a consistent monochrome camera outline in the sidebar and empty states.
 */
export function InstagramGlyph({
  className,
  strokeWidth = 1.6,
  ...props
}: React.ComponentProps<"svg">) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn("size-4", className)}
      {...props}
    >
      <rect x="3.25" y="3.25" width="17.5" height="17.5" rx="5.25" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.1" cy="6.9" r="0.95" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Wordmark lockup used in the sidebar header. */
export function FactoryMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-md bg-ink text-canvas",
        className,
      )}
      aria-hidden="true"
    >
      <InstagramGlyph className="size-[18px]" />
    </span>
  );
}
