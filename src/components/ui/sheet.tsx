"use client";

import * as SheetPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type * as React from "react";

import { cn } from "@/lib/utils";

const Sheet = SheetPrimitive.Root;
const SheetTrigger = SheetPrimitive.Trigger;
const SheetClose = SheetPrimitive.Close;

const sideClasses = {
  right:
    "inset-y-0 right-0 h-full w-[min(26rem,100vw)] border-l data-[state=open]:animate-slide-in-right data-[state=closed]:animate-slide-out-right",
  left: "inset-y-0 left-0 h-full w-[min(20rem,100vw)] border-r data-[state=open]:animate-slide-in-left data-[state=closed]:animate-slide-out-left",
  bottom:
    "inset-x-0 bottom-0 max-h-[85dvh] rounded-t-xl border-t data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out",
} as const;

function SheetContent({
  className,
  children,
  side = "right",
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  side?: keyof typeof sideClasses;
  showCloseButton?: boolean;
}) {
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay
        data-slot="sheet-overlay"
        className="fixed inset-0 z-50 bg-[var(--scrim)] backdrop-blur-[2px] data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out"
      />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        className={cn(
          "fixed z-50 flex flex-col overflow-hidden border-line bg-surface shadow-pop",
          sideClasses[side],
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton ? (
          <SheetPrimitive.Close
            className="absolute top-4 right-4 rounded-full p-1.5 text-ink-3 transition-colors duration-150 ease-soft hover:bg-surface-2 hover:text-ink"
            aria-label="Close panel"
          >
            <X className="size-4" />
          </SheetPrimitive.Close>
        ) : null}
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<"header">) {
  return (
    <header
      data-slot="sheet-header"
      className={cn("flex flex-col gap-1.5 border-b border-line px-5 py-4", className)}
      {...props}
    />
  );
}

function SheetBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-body"
      className={cn("scrollbar-slim flex-1 overflow-y-auto px-5 py-4", className)}
      {...props}
    />
  );
}

function SheetFooter({ className, ...props }: React.ComponentProps<"footer">) {
  return (
    <footer
      data-slot="sheet-footer"
      className={cn(
        "mt-auto flex items-center justify-end gap-2 border-t border-line px-5 py-4",
        className,
      )}
      {...props}
    />
  );
}

function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn("text-base leading-tight font-medium tracking-[-0.01em]", className)}
      {...props}
    />
  );
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-[13px] leading-relaxed text-ink-2", className)}
      {...props}
    />
  );
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetBody,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};
