"use client";

import { motion } from "framer-motion";
import { CirclePlus, PanelLeftClose, Rows3 } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { FactoryMark } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { TooltipHint } from "@/components/ui/tooltip";
import { useIsDesktop } from "@/hooks/use-media-query";
import { usePostsSummary } from "@/hooks/use-posts";
import { APP_SHORT_NAME, SIDEBAR } from "@/lib/constants";
import { NAV_SECTIONS } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/providers/sidebar-provider";
import { useUIStore } from "@/store/ui-store";
import type { NavItem } from "@/types/navigation";

/**
 * How long the pointer has to rest on the rail before it expands. Without it,
 * simply crossing the sidebar on the way somewhere else would yank it open.
 */
const HOVER_OPEN_DELAY_MS = 90;

/**
 * Grace period before a collapsed panel shuts. Closing instantly makes the
 * panel snap away while the pointer is still drifting across its edge (or a
 * tooltip); the delay reads as the panel "letting go" instead.
 */
const HOVER_CLOSE_DELAY_MS = 200;

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function navBadge(item: NavItem, pending: number) {
  if (item.id !== "queue" || pending === 0) return null;
  return (
    <Badge tone="warning" size="sm" className="ml-auto tnum">
      {pending}
    </Badge>
  );
}

function SidebarNav({
  showLabels,
  onNavigate,
}: {
  showLabels: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const summary = usePostsSummary();

  return (
    <nav aria-label="Primary" className="flex flex-col gap-6 px-3 py-4">
      {NAV_SECTIONS.map((section) => (
        <div key={section.id} className="flex flex-col gap-1">
          {showLabels ? (
            <p className="px-2.5 pb-1 text-[11px] font-medium tracking-[0.08em] text-ink-3 uppercase">
              {section.label}
            </p>
          ) : (
            <span className="sr-only">{section.label}</span>
          )}

          {section.items.map((item) => {
            const active = isActivePath(pathname, item.href);
            const Icon = item.icon;
            const badge = navBadge(item, summary.pendingReview);

            const link = (
              <Link
                key={item.id}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                aria-keyshortcuts={`G ${item.shortcutKey}`}
                className={cn(
                  "group relative flex items-center gap-2.5 overflow-hidden rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors duration-150 ease-soft",
                  showLabels ? "justify-start" : "justify-center px-0",
                  active ? "text-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
                )}
              >
                {active ? (
                  <motion.span
                    layoutId={showLabels ? "nav-active" : "nav-active-collapsed"}
                    className="absolute inset-0 -z-10 rounded-md bg-surface-2"
                    transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                  />
                ) : null}

                <Icon
                  className={cn(
                    "size-4 shrink-0 transition-colors",
                    active ? "text-ink" : "text-ink-3 group-hover:text-ink-2",
                  )}
                />

                {showLabels ? (
                  <span className="flex min-w-0 flex-1 items-center gap-2">
                    <span className="truncate whitespace-nowrap">{item.label}</span>
                    {badge}
                  </span>
                ) : (
                  // While collapsed the name still reaches assistive tech even
                  // though only the icon paints.
                  <span className="sr-only">{item.label}</span>
          )}
              </Link>
            );

            /*
             * Icons and names are never cropped on hover: the tooltip lives in a
             * portal at the document root, so no sidebar overflow can clip it,
             * and Radix shifts it back inside the viewport near an edge.
             */
            return showLabels ? (
              link
            ) : (
              <TooltipHint
                key={item.id}
                label={item.label}
                side="right"
                shortcut={["G", item.shortcutKey.toUpperCase()]}
              >
                {link}
              </TooltipHint>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function SidebarFooter({ showLabels }: { showLabels: boolean }) {
  const setGenerateOpen = useUIStore((state) => state.setGenerateOpen);

  return (
    <div className="mt-auto shrink-0 border-t border-line p-3">
      {showLabels ? (
        <Button
          variant="secondary"
          className="w-full justify-start bg-surface-2 hover:bg-surface-3"
          onClick={() => setGenerateOpen(true)}
        >
          <CirclePlus />
          Generate content
        </Button>
      ) : (
        <TooltipHint label="Generate content" side="right">
          <Button
            size="icon-sm"
            variant="primary"
            aria-label="Generate content"
            className="mx-auto"
            onClick={() => setGenerateOpen(true)}
          >
            <CirclePlus />
          </Button>
        </TooltipHint>
      )}
    </div>
  );
}

function SidebarHeader({
  showLabels,
  mode,
}: {
  showLabels: boolean;
  mode: string;
}) {
  const { toggleCollapsed } = useSidebar();

  return (
    <div
      className={cn(
        "flex h-14 shrink-0 items-center gap-2.5 overflow-hidden border-b border-line px-3",
        showLabels ? "justify-start" : "justify-center px-0",
      )}
    >
      <Link
        href="/"
        className="flex min-w-0 items-center gap-2.5 rounded-md outline-none"
        aria-label={`${APP_SHORT_NAME} home`}
      >
        <FactoryMark />
        {showLabels ? (
          <span className="flex min-w-0 flex-col leading-none">
            <span className="truncate text-[13px] font-medium tracking-[-0.01em]">
              {APP_SHORT_NAME}
            </span>
            <span className="mt-0.5 truncate text-[11px] text-ink-3">
              3 brands · 1 workspace
            </span>
          </span>
        ) : null}
      </Link>

      {showLabels ? (
        mode === "pinned" ? (
          <TooltipHint label="Collapse sidebar" shortcut={["⌘", "B"]}>
            <Button
              size="icon-sm"
              variant="ghost"
              className="ml-auto shrink-0"
              onClick={toggleCollapsed}
              aria-label="Collapse sidebar"
              aria-keyshortcuts="Meta+B Control+B"
            >
              <PanelLeftClose />
            </Button>
          </TooltipHint>
        ) : null
      ) : null}
    </div>
  );
}

/**
 * The persistent desktop sidebar.
 *
 * `pinned` resizes in flow (the page reflows with it), `hover` keeps its rail
 * width in flow and expands as an overlay so nothing on the page jumps, and
 * `rail` never expands at all — the name arrives as a tooltip instead.
 */
export function Sidebar() {
  const { mode, collapsed, hydrated } = useSidebar();
  const [hovered, setHovered] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<"open" | "close" | null>(null);

  const overlay = mode === "hover";
  const showLabels = mode === "pinned" ? !collapsed : overlay ? hovered : false;

  const cancelPending = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    pendingRef.current = null;
  }, []);

  const open = useCallback(() => {
    // Reversing a scheduled close is the whole point of the grace period; an
    // already-scheduled open is never doubled.
    if (pendingRef.current === "open") return;
    cancelPending();
    pendingRef.current = "open";
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      pendingRef.current = null;
      setHovered(true);
    }, HOVER_OPEN_DELAY_MS);
  }, [cancelPending]);

  const close = useCallback(
    (immediate = false) => {
      cancelPending();
      if (!hovered) return;
      if (immediate) {
        setHovered(false);
        return;
      }
      pendingRef.current = "close";
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        pendingRef.current = null;
        setHovered(false);
      }, HOVER_CLOSE_DELAY_MS);
    },
    [hovered, cancelPending],
  );

  useEffect(() => cancelPending, [cancelPending]);

  // Leaving hover mode must not leave a stale expanded state behind.
  useEffect(() => {
    cancelPending();
    if (!overlay) setHovered(false);
  }, [overlay, cancelPending]);

  // Focus hopping between nav items bubbles through here too — only a genuine
  // exit (next focus outside the panel) may schedule a close.
  const handleBlurCapture = (event: React.FocusEvent<HTMLDivElement>) => {
    const next = event.relatedTarget;
    if (next instanceof Node && containerRef.current?.contains(next)) return;
    close();
  };

  const handleKeyDownCapture = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" && hovered) {
      event.stopPropagation();
      close(true);
    }
  };

  // A click anywhere outside the expanded panel dismisses it, matching how
  // every other overlay in the product behaves.
  useEffect(() => {
    if (!overlay || !hovered) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && containerRef.current?.contains(target)) return;
      close(true);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [overlay, hovered, close]);

  return (
    <aside
      data-mode={mode}
      data-collapsed={!showLabels}
      className={cn(
        "sticky top-0 hidden h-dvh shrink-0 lg:flex",
        mode === "pinned" && "transition-[width] duration-200 ease-soft",
        mode === "pinned" && (collapsed ? "w-[76px]" : "w-[272px]"),
        overlay && "w-[76px]",
        mode === "rail" && "w-[76px]",
        !hydrated && "invisible",
      )}
    >
      <div
        ref={containerRef}
        onMouseEnter={overlay ? open : undefined}
        // Pointer exit closes at once — the grace period is for drift, not for
        // deliberate departure.
        onMouseLeave={overlay ? () => close(true) : undefined}
        // Keyboard users get the same reveal as pointer users, so tabbing to a
        // link never lands on an unlabelled icon.
        onFocusCapture={overlay ? open : undefined}
        onBlurCapture={overlay ? handleBlurCapture : undefined}
        onKeyDownCapture={overlay ? handleKeyDownCapture : undefined}
        className={cn(
          "flex h-full min-h-0 flex-col overflow-hidden border-r border-line bg-surface",
          overlay &&
            // Sits above the sticky topbar (z-30) so the expanded panel is
            // never clipped by page-level sticky elements.
            "absolute inset-y-0 left-0 z-40 transition-[width,box-shadow] duration-200 ease-soft",
          overlay && hovered && "shadow-pop",
          !overlay && "relative w-full",
        )}
        style={
          overlay
            ? { width: hovered ? SIDEBAR.width : SIDEBAR.railWidth }
            : undefined
        }
      >
        <SidebarHeader showLabels={showLabels} mode={mode} />
        <ScrollArea className="flex-1">
          <SidebarNav showLabels={showLabels} />
        </ScrollArea>
        <SidebarFooter showLabels={showLabels} />
      </div>
    </aside>
  );
}

/** Mobile navigation lives in a left-side sheet mirroring the desktop list. */
export function MobileSidebar() {
  const { mobileOpen, setMobileOpen, cycleMode } = useSidebar();
  const isDesktop = useIsDesktop();

  // Growing the viewport past the desktop breakpoint dismisses the sheet so the
  // persistent sidebar is never blocked by a stale overlay.
  useEffect(() => {
    if (isDesktop && mobileOpen) setMobileOpen(false);
  }, [isDesktop, mobileOpen, setMobileOpen]);

  return (
    <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
      <SheetContent side="left" className="w-[288px] p-0">
        <SheetHeader className="h-14 flex-row items-center gap-2.5 px-3 py-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <Link href="/" className="flex items-center gap-2.5" onClick={() => setMobileOpen(false)}>
            <FactoryMark />
            <span className="text-[13px] font-medium">{APP_SHORT_NAME}</span>
          </Link>
          <TooltipHint label="Sidebar behaviour">
            <Button
              size="icon-sm"
              variant="ghost"
              className="ml-auto"
              onClick={cycleMode}
              aria-label="Change sidebar behaviour"
            >
              <Rows3 />
            </Button>
          </TooltipHint>
        </SheetHeader>
        <ScrollArea className="flex-1">
          <SidebarNav showLabels onNavigate={() => setMobileOpen(false)} />
        </ScrollArea>
        <SidebarFooter showLabels />
      </SheetContent>
    </Sheet>
  );
}
