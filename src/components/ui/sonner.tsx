"use client";

import { Toaster as SonnerToaster } from "sonner";
import type * as React from "react";

export function Toaster(props: React.ComponentProps<typeof SonnerToaster>) {
  return (
    <SonnerToaster
      position="bottom-right"
      offset={20}
      gap={10}
      closeButton
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "group flex w-[356px] items-start gap-3 rounded-lg border border-line bg-surface px-4 py-3.5 shadow-pop",
          title: "text-[13px] font-medium text-ink",
          description: "mt-1 text-[12.5px] leading-relaxed text-ink-2",
          icon: "mt-0.5 text-ink-2 [&_svg]:size-4",
          actionButton:
            "ml-auto h-7 shrink-0 rounded-full border border-line bg-surface px-2.5 text-xs font-medium text-ink hover:bg-surface-2",
          cancelButton:
            "ml-auto h-7 shrink-0 rounded-full px-2.5 text-xs font-medium text-ink-2 hover:bg-surface-2",
          closeButton:
            "absolute -top-1.5 -left-1.5 flex size-5 items-center justify-center rounded-full border border-line bg-surface text-ink-2 opacity-0 transition-opacity group-hover:opacity-100",
          success: "[&_[data-icon]]:text-success",
          error: "[&_[data-icon]]:text-danger",
          warning: "[&_[data-icon]]:text-warning",
        },
      }}
      {...props}
    />
  );
}
