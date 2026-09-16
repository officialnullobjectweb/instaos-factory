import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full border font-medium whitespace-nowrap transition-colors [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      tone: {
        neutral: "border-line bg-surface-2 text-ink-2",
        outline: "border-line bg-surface text-ink-2",
        accent: "border-transparent bg-ink text-canvas",
        "accent-outline": "border-ink/20 bg-surface text-ink",
        success: "border-success/20 bg-success-soft text-success",
        "success-outline": "border-success/30 bg-surface text-success",
        warning: "border-warning/20 bg-warning-soft text-warning",
        danger: "border-danger/20 bg-danger-soft text-danger",
        "danger-outline": "border-danger/30 bg-surface text-danger",
      },
      size: {
        sm: "h-5 px-2 text-[11px] [&_svg]:size-3",
        md: "h-6 px-2.5 text-xs [&_svg]:size-3.5",
      },
    },
    defaultVariants: { tone: "neutral", size: "md" },
  },
);

export type BadgeProps = React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants>;

export function Badge({ className, tone, size, ...props }: BadgeProps) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ tone, size }), className)}
      {...props}
    />
  );
}

export { badgeVariants };
