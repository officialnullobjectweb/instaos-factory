"use client";

import type { ReactNode } from "react";

import { CommandPalette } from "@/components/command/command-palette";
import { MobileSidebar, Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { GenerateDialog } from "@/features/generation/components/generate-dialog";
import { KeyboardShortcutsProvider } from "@/providers/keyboard-shortcuts-provider";
import { SidebarProvider } from "@/providers/sidebar-provider";
import { useUIStore } from "@/store/ui-store";

export function AppShell({ children }: { children: ReactNode }) {
  const density = useUIStore((state) => state.density);

  return (
    <SidebarProvider>
      <KeyboardShortcutsProvider>
        <a
          href="#main-content"
          className="sr-only rounded-full bg-ink px-4 py-2 text-[13px] text-canvas focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50"
        >
          Skip to content
        </a>

        {/* Density preference from Settings is applied to the whole shell. */}
        <div data-density={density} className="flex min-h-dvh">
          <Sidebar />
          <MobileSidebar />

          <div className="flex min-w-0 flex-1 flex-col">
            <Topbar />
            <main id="main-content" className="flex-1 pb-20">
              {children}
            </main>
          </div>

          <CommandPalette />
          {/* One generation dialog for the whole shell, opened from anywhere. */}
          <GenerateDialog />
        </div>
      </KeyboardShortcutsProvider>
    </SidebarProvider>
  );
}
