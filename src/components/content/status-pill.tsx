import type { LucideIcon } from "lucide-react";

import { DOT_CLASSES, type Tone } from "@/lib/status";
import { cn } from "@/lib/utils";

interface StatusPillProps {
  tone: Tone;
  label: string;
  icon?: LucideIcon;
  /** Hides the label on small screens, keeping the dot only. */
  compact?: boolean;
  className?: string;
}

export function StatusPill({
  tone,
  label,
  icon: Icon,
  compact = false,
  className,
}: StatusPillProps) {
  return (
    <span
      className={cn(
        "flex items-center gap-1.5 text-[12px] text-ink-2",
        className,
      )}
    >
      {Icon ? (
        <Icon className="size-3.5" />
      ) : (
        <span
          aria-hidden="true"
          className={cn("size-1.5 rounded-full", DOT_CLASSES[tone])}
        />
      )}
      <span className={cn(compact && "hidden sm:inline")}>{label}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}
