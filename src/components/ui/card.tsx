import type * as React from "react";

import { cn } from "@/lib/utils";

interface CardProps extends React.ComponentProps<"section"> {
  variant?: "default" | "plain" | "muted";
}

export function Card({ className, variant = "default", ...props }: CardProps) {
  return (
    <section
      data-slot="card"
      className={cn(
        "flex flex-col rounded-xl text-ink transition-shadow duration-200 ease-soft",
        variant === "default" && "border border-line bg-surface shadow-card",
        variant === "muted" && "border border-line bg-surface-2",
        variant === "plain" && "bg-transparent",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.ComponentProps<"header">) {
  return (
    <header
      data-slot="card-header"
      className={cn(
        "flex items-start justify-between gap-4 px-5 pt-5 pb-4",
        className,
      )}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return (
    <h3
      data-slot="card-title"
      className={cn("text-[15px] leading-tight font-medium text-ink", className)}
      {...props}
    />
  );
}

export function CardDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="card-description"
      className={cn("text-[13px] leading-relaxed text-ink-2", className)}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-5 pb-5", className)}
      {...props}
    />
  );
}

export function CardFooter({ className, ...props }: React.ComponentProps<"footer">) {
  return (
    <footer
      data-slot="card-footer"
      className={cn(
        "mt-auto flex items-center justify-between gap-3 border-t border-line px-5 py-3.5",
        className,
      )}
      {...props}
    />
  );
}
