import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  /** Compact variant sits inside cards and table bodies. */
  size?: "sm" | "md";
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  size = "md",
}: EmptyStateProps) {
  return (
    <div
      role="status"
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-line text-center",
        size === "md" ? "px-6 py-16" : "px-5 py-10",
        className,
      )}
    >
      <span
        className={cn(
          "flex items-center justify-center rounded-full border border-line bg-surface-2 text-ink-2",
          size === "md" ? "size-11" : "size-9",
        )}
      >
        <Icon className={size === "md" ? "size-5" : "size-4"} />
      </span>

      <div className="flex flex-col gap-1">
        <p className={cn("font-medium", size === "md" ? "text-[15px]" : "text-[14px]")}>
          {title}
        </p>
        {description ? (
          <p className="max-w-sm text-[13px] leading-relaxed text-ink-2">
            {description}
          </p>
        ) : null}
      </div>

      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
