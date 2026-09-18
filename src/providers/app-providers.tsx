"use client";

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";

import { ToastStack } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/providers/theme-provider";
import { WorkspaceHydration } from "@/providers/workspace-hydration";

/**
 * Only genuinely client-only concerns live here (theme, portals, tooltips,
 * toasts, store hydration) so the rest of the tree can stay server-rendered.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider>
        <TooltipProvider>
          <WorkspaceHydration>{children}</WorkspaceHydration>
          <ToastStack />
        </TooltipProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
