import { Badge } from "@/components/ui/badge";
import { CONTENT_STATUS_META } from "@/lib/status";
import { cn } from "@/lib/utils";
import type { ContentStatus } from "@/types";

interface StatusBadgeProps {
  status: ContentStatus;
  size?: "sm" | "md";
  withIcon?: boolean;
  className?: string;
}

export function StatusBadge({
  status,
  size = "md",
  withIcon = true,
  className,
}: StatusBadgeProps) {
  const meta = CONTENT_STATUS_META[status];
  const Icon = meta.icon;

  return (
    <Badge
      tone={meta.tone}
      size={size}
      className={className}
      aria-label={`Status: ${meta.label}`}
    >
      {withIcon ? (
        <Icon className="size-3" />
      ) : (
        <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      )}
      {meta.label}
    </Badge>
  );
}

interface FormatTagProps {
  label: string;
  className?: string;
}

/** Mono format label — keeps format metadata visually quiet. */
export function FormatTag({ label, className }: FormatTagProps) {
  return (
    <span
      className={cn(
        "font-mono text-[11px] tracking-[0.04em] text-ink-3 uppercase",
        className,
      )}
    >
      {label}
    </span>
  );
}
