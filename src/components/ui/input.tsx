import type * as React from "react";

import { cn } from "@/lib/utils";

export function Input({ className, type = "text", ...props }: React.ComponentProps<"input">) {
  return (
    <input
      data-slot="input"
      type={type}
      className={cn(
        "h-9 w-full min-w-0 rounded-full border border-line bg-surface px-3.5 text-sm text-ink transition-colors duration-150 ease-soft outline-none",
        "placeholder:text-ink-3 hover:border-line-strong",
        "focus-visible:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink/15",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "min-h-24 w-full rounded-lg border border-line bg-surface px-3.5 py-3 text-sm leading-relaxed text-ink transition-colors duration-150 ease-soft outline-none",
        "placeholder:text-ink-3 hover:border-line-strong",
        "focus-visible:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink/15",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
