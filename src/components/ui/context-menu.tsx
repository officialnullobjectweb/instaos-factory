"use client";

import * as ContextMenuPrimitive from "@radix-ui/react-context-menu";
import { Check } from "lucide-react";
import type * as React from "react";

import { cn } from "@/lib/utils";

const ContextMenu = ContextMenuPrimitive.Root;
const ContextMenuTrigger = ContextMenuPrimitive.Trigger;
const ContextMenuGroup = ContextMenuPrimitive.Group;
const ContextMenuSub = ContextMenuPrimitive.Sub;

function ContextMenuContent({
  className,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Content>) {
  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Content
        data-slot="context-menu-content"
        className={cn(
          "z-50 min-w-52 overflow-hidden rounded-lg border border-line bg-surface p-1.5 shadow-pop",
          "data-[state=open]:animate-scale-in data-[state=closed]:animate-fade-out",
          className,
        )}
        {...props}
      />
    </ContextMenuPrimitive.Portal>
  );
}

function ContextMenuItem({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Item> & {
  variant?: "default" | "danger";
}) {
  return (
    <ContextMenuPrimitive.Item
      data-slot="context-menu-item"
      className={cn(
        "relative flex cursor-pointer items-center gap-2.5 rounded-sm px-2.5 py-1.5 text-[13px] text-ink outline-none select-none",
        "transition-colors duration-150 ease-soft",
        "data-[highlighted]:bg-surface-2 data-[disabled]:pointer-events-none data-[disabled]:opacity-45",
        "[&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-ink-2",
        variant === "danger" &&
          "text-danger [&_svg]:text-danger data-[highlighted]:bg-danger-soft",
        className,
      )}
      {...props}
    />
  );
}

function ContextMenuCheckboxItem({
  className,
  children,
  checked,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.CheckboxItem>) {
  return (
    <ContextMenuPrimitive.CheckboxItem
      data-slot="context-menu-checkbox-item"
      checked={checked}
      className={cn(
        "relative flex cursor-pointer items-center gap-2.5 rounded-sm py-1.5 pr-2.5 pl-8 text-[13px] text-ink outline-none select-none",
        "data-[highlighted]:bg-surface-2",
        className,
      )}
      {...props}
    >
      <span className="absolute left-2.5 flex size-3.5 items-center justify-center">
        <ContextMenuPrimitive.ItemIndicator>
          <Check className="size-3.5" />
        </ContextMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </ContextMenuPrimitive.CheckboxItem>
  );
}

function ContextMenuLabel({
  className,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Label>) {
  return (
    <ContextMenuPrimitive.Label
      data-slot="context-menu-label"
      className={cn(
        "px-2.5 py-1.5 text-[11px] font-medium tracking-[0.06em] text-ink-3 uppercase",
        className,
      )}
      {...props}
    />
  );
}

function ContextMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Separator>) {
  return (
    <ContextMenuPrimitive.Separator
      data-slot="context-menu-separator"
      className={cn("-mx-1.5 my-1 h-px bg-line", className)}
      {...props}
    />
  );
}

export {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuCheckboxItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuGroup,
  ContextMenuSub,
};
