"use client";

import { Menu, PanelLeftOpen, Plus, Rows3, Search } from "lucide-react";
import { usePathname } from "next/navigation";

import { BrandScopeMenu } from "@/components/layout/brand-scope-menu";
import { UserMenu } from "@/components/layout/user-menu";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { Button } from "@/components/ui/button";
import { Clock } from "@/components/ui/clock";
import { TooltipHint } from "@/components/ui/tooltip";
import {
  SIDEBAR_MODE_META,
  SIDEBAR_MODE_ORDER,
  type SidebarMode,
} from "@/lib/constants";
import { getNavItemByHref } from "@/lib/navigation";
import { useSidebar } from "@/providers/sidebar-provider";
import { useUIStore } from "@/store/ui-store";

function Breadcrumb() {
  const pathname = usePathname();
  const item = getNavItemByHref(pathname);

  return (
    <nav aria-label="Breadcrumb" className="hidden min-w-0 md:block">
      <ol className="flex items-center gap-2 text-[13px]">
        <li className="text-ink-3">Workspace</li>
        <li aria-hidden="true" className="text-ink-3">
          /
        </li>
        <li aria-current="page" className="truncate font-medium text-ink">
          {item?.label ?? "Dashboard"}
        </li>
      </ol>
    </nav>
  );
}

export function Topbar() {
  const { setMobileOpen, mode, cycleMode } = useSidebar();
  const setCommandOpen = useUIStore((state) => state.setCommandOpen);
  const setGenerateOpen = useUIStore((state) => state.setGenerateOpen);

  const nextMode: SidebarMode =
    SIDEBAR_MODE_ORDER[
      (SIDEBAR_MODE_ORDER.indexOf(mode) + 1) % SIDEBAR_MODE_ORDER.length
    ];

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface">
      <div className="shell-container flex h-14 items-center gap-2">
        <Button
          variant="ghost"
          size="icon-sm"
          className="lg:hidden"
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation"
        >
          <Menu />
        </Button>

        {/*
         * The sidebar has three behaviours, so this control cycles rather than
         * toggles — the tooltip always names what the next press will do. The
         * same setting is written out in full in Settings → Workspace.
         */}
        <TooltipHint
          label={`Sidebar: ${SIDEBAR_MODE_META[nextMode].label}`}
          shortcut={["⌘", "B"]}
          className="hidden lg:flex"
        >
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={cycleMode}
            aria-label={`Change sidebar behaviour. Next: ${SIDEBAR_MODE_META[nextMode].label}`}
            aria-keyshortcuts="Meta+B Control+B"
          >
            {mode === "pinned" ? <Rows3 /> : <PanelLeftOpen />}
          </Button>
        </TooltipHint>

        <Breadcrumb />

        <button
          type="button"
          onClick={() => setCommandOpen(true)}
          aria-label="Search or jump to"
          aria-keyshortcuts="Meta+K Control+K"
          className="ml-auto flex h-9 w-full max-w-72 min-w-0 items-center gap-2.5 rounded-full border border-line bg-surface-2 px-3.5 text-left text-[13px] text-ink-3 transition-colors duration-150 ease-soft hover:border-line-strong hover:text-ink-2 lg:ml-0 lg:max-w-80"
        >
          <Search className="size-4 shrink-0" />
          <span className="truncate">Search or jump to…</span>
          <kbd className="ml-auto hidden shrink-0 items-center gap-0.5 font-mono text-[11px] sm:flex">
            <span className="rounded-xs border border-line bg-surface px-1">⌘</span>
            <span className="rounded-xs border border-line bg-surface px-1">K</span>
          </kbd>
        </button>

        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <Clock className="hidden xl:flex" />

          <BrandScopeMenu />

          <NotificationBell />

          <Button
            variant="primary"
            size="sm"
            className="hidden sm:inline-flex"
            onClick={() => setGenerateOpen(true)}
            aria-keyshortcuts="Meta+Enter Control+Enter"
          >
            <Plus />
            Generate post
          </Button>

          <UserMenu />
        </div>
      </div>
    </header>
  );
}
