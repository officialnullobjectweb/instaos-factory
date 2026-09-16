import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface SectionProps {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Section headings use the smaller editorial scale inside the page. */
  as?: "h2" | "h3";
}

export function Section({
  title,
  description,
  action,
  children,
  className,
  as: Heading = "h2",
}: SectionProps) {
  return (
    <section className={cn("flex flex-col gap-4", className)}>
      {title ? (
        <div className="flex items-end justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1">
            <Heading className="text-[17px] font-medium tracking-[-0.02em]">
              {title}
            </Heading>
            {description ? (
              <p className="text-[13px] leading-relaxed text-ink-2">
                {description}
              </p>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}
