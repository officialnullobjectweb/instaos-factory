"use client";

import * as AvatarPrimitive from "@radix-ui/react-avatar";
import type * as React from "react";

import { cn } from "@/lib/utils";

const sizeMap = {
  xs: "size-6 text-[10px]",
  sm: "size-8 text-[11px]",
  md: "size-9 text-xs",
  lg: "size-11 text-[13px]",
  xl: "size-14 text-base",
} as const;

export type AvatarSize = keyof typeof sizeMap;

interface AvatarProps extends React.ComponentProps<typeof AvatarPrimitive.Root> {
  size?: AvatarSize;
  tone?: "muted" | "ink";
}

export function Avatar({
  className,
  size = "md",
  tone = "muted",
  ...props
}: AvatarProps) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      className={cn(
        "relative flex shrink-0 overflow-hidden rounded-full border",
        tone === "muted"
          ? "border-line bg-surface-2 text-ink-2"
          : "border-transparent bg-ink text-canvas",
        sizeMap[size],
        className,
      )}
      {...props}
    />
  );
}

export function AvatarImage({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn("aspect-square size-full object-cover", className)}
      {...props}
    />
  );
}

export function AvatarFallback({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        "flex size-full items-center justify-center font-medium tracking-[0.04em] uppercase",
        className,
      )}
      {...props}
    />
  );
}

interface InitialsAvatarProps {
  initials: string;
  tone?: "muted" | "ink";
  size?: AvatarSize;
  className?: string;
  /** Rendered as a tooltip-free accessible label. */
  label?: string;
}

/** Convenience wrapper: initials only, no remote image required. */
export function InitialsAvatar({
  initials,
  tone = "muted",
  size = "md",
  className,
  label,
}: InitialsAvatarProps) {
  return (
    <Avatar size={size} tone={tone} className={className} aria-label={label}>
      <AvatarFallback>{initials}</AvatarFallback>
    </Avatar>
  );
}
