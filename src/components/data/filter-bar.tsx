"use client";

import { Funnel, RotateCcw } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FilterBarProps {
  children: ReactNode;
  activeCount?: number;
  onReset?: () => void;
  /** Rendered on the right, e.g. view switches or bulk actions. */
  trailing?: ReactNode;
  className?: string;
  label?: string;
}

export function FilterBar({
  children,
  activeCount = 0,
  onReset,
  trailing,
  className,
  label = "Filters",
}: FilterBarProps) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface p-2.5",
        className,
      )}
    >
      <span className="flex items-center gap-1.5 pl-1.5 text-[12px] font-medium text-ink-3">
        <Funnel className="size-3.5" />
        {activeCount > 0 ? (
          <span className="tnum">{activeCount} active</span>
        ) : (
          <span>Filters</span>
        )}
      </span>

      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        {children}
      </div>

      {activeCount > 0 && onReset ? (
        <Button variant="ghost" size="xs" onClick={onReset}>
          <RotateCcw />
          Reset
        </Button>
      ) : null}

      {trailing}
    </div>
  );
}
