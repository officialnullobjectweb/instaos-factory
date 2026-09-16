import type { ReactNode } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface SettingsSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  footer?: ReactNode;
}

export function SettingsSection({
  title,
  description,
  children,
  footer,
  className,
}: SettingsSectionProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex flex-col gap-1">
          <CardTitle>{title}</CardTitle>
          {description ? (
            <p className="text-[13px] leading-relaxed text-ink-2">{description}</p>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col pt-0">{children}</CardContent>
      {footer ? (
        <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-4">
          {footer}
        </div>
      ) : null}
    </Card>
  );
}

interface SettingsRowProps {
  title: string;
  description?: string;
  children: ReactNode;
  /** Stacks the control under the label on small screens. */
  stacked?: boolean;
  className?: string;
}

export function SettingsRow({
  title,
  description,
  children,
  stacked = false,
  className,
}: SettingsRowProps) {
  return (
    <div
      className={cn(
        "flex gap-4 border-b border-line py-4 last:border-0 last:pb-0",
        stacked
          ? "flex-col"
          : "flex-col sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="flex flex-col gap-0.5">
        <span className="text-[13.5px] font-medium text-ink">{title}</span>
        {description ? (
          <span className="max-w-md text-[12.5px] leading-relaxed text-ink-2">
            {description}
          </span>
        ) : null}
      </div>
      <div className={cn("shrink-0", stacked && "w-full")}>{children}</div>
    </div>
  );
}
