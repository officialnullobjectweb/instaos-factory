import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  /** Filters, tabs or segmented controls rendered under the title block. */
  toolbar?: ReactNode;
  className?: string;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  toolbar,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn("shell-container pt-10 pb-6 md:pt-12", className)}>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          {eyebrow ? (
            <p className="text-[11px] font-medium tracking-[0.14em] text-ink-3 uppercase">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="text-[30px] leading-[1.08] font-medium tracking-[-0.03em] text-balance md:text-[38px]">
            {title}
          </h1>
          {description ? (
            <p className="max-w-2xl text-[14px] leading-relaxed text-ink-2 md:text-[15px]">
              {description}
            </p>
          ) : null}
        </div>

        {actions ? (
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        ) : null}
      </div>

      {toolbar ? <div className="mt-6">{toolbar}</div> : null}
    </header>
  );
}
