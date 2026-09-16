import type * as React from "react";

import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn("animate-sheen rounded-md bg-surface-3", className)}
      {...props}
    />
  );
}

interface SkeletonTextProps {
  lines?: number;
  className?: string;
  lineClassName?: string;
}

/** Multi-line text placeholder; the last line is shortened for realism. */
export function SkeletonText({
  lines = 3,
  className,
  lineClassName,
}: SkeletonTextProps) {
  return (
    <div className={cn("space-y-2", className)} aria-hidden="true">
      {Array.from({ length: lines }, (_, index) => (
        <div
          key={index}
          className={cn(
            "h-3 animate-sheen rounded-sm bg-surface-3",
            index === lines - 1 ? "w-2/3" : "w-full",
            lineClassName,
          )}
        />
      ))}
    </div>
  );
}
