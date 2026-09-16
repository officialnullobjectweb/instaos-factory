"use client";

import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type * as React from "react";

import { cn } from "@/lib/utils";

function TooltipProvider({
  delayDuration = 220,
  skipDelayDuration = 320,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      skipDelayDuration={skipDelayDuration}
      {...props}
    />
  );
}

function Tooltip(props: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />;
}

function TooltipTrigger(
  props: React.ComponentProps<typeof TooltipPrimitive.Trigger>,
) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

function TooltipContent({
  className,
  sideOffset = 8,
  // Keeps the bubble off the window edge when the trigger sits beside it, so a
  // label in the collapsed sidebar is never cropped by the viewport.
  collisionPadding = 10,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className={cn(
          "z-50 w-fit max-w-64 rounded-md bg-ink px-2.5 py-1.5 text-xs leading-snug text-canvas shadow-pop",
          "data-[state=delayed-open]:animate-scale-in data-[state=closed]:animate-fade-out",
          className,
        )}
        {...props}
      >
        {children}
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}

interface TooltipHintProps {
  label: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  shortcut?: string[];
  className?: string;
}

/** Label + optional key chips, the pattern used across the shell. */
function TooltipHint({
  label,
  children,
  side = "top",
  shortcut,
  className,
}: TooltipHintProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side} className={className}>
        <span className="flex items-center gap-2">
          {label}
          {shortcut?.length ? (
            <span className="flex items-center gap-0.5 opacity-70">
              {shortcut.map((key) => (
                <kbd
                  key={key}
                  className="rounded-xs bg-canvas/15 px-1 font-mono text-[10px] leading-4"
                >
                  {key}
                </kbd>
              ))}
            </span>
          ) : null}
        </span>
      </TooltipContent>
    </Tooltip>
  );
}

export {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
  TooltipHint,
};
