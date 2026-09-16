"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { useLocalStorage } from "@/hooks/use-local-storage";
import { SIDEBAR, SIDEBAR_MODE_ORDER, type SidebarMode } from "@/lib/constants";

interface SidebarContextValue {
  /**
   * How the sidebar behaves. Chosen in Settings → Workspace and remembered:
   * - `pinned`  full rail that collapses on demand
   * - `hover`   icon rail that expands over the page while hovered
   * - `rail`    icons only, forever; the label arrives as a tooltip
   */
  mode: SidebarMode;
  setMode: (mode: SidebarMode) => void;
  /** ⌘B walks pinned → hover → rail → pinned. */
  cycleMode: () => void;
  /** Only meaningful in `pinned` mode. */
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  toggleCollapsed: () => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  /** False until the persisted preference has been read on the client. */
  hydrated: boolean;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

function isSidebarMode(value: unknown): value is SidebarMode {
  return typeof value === "string" && SIDEBAR_MODE_ORDER.includes(value as SidebarMode);
}

/**
 * Shell-level layout state lives in context (not a store): it is read by the
 * sidebar, topbar and command palette and never needs to be consumed outside
 * the workspace tree.
 */
export function SidebarProvider({ children }: { children: ReactNode }) {
  const {
    value: mode,
    setValue: setModeValue,
    hydrated: modeHydrated,
  } = useLocalStorage<SidebarMode>(SIDEBAR.storageKey, "pinned");
  const {
    value: collapsed,
    setValue: setCollapsed,
    hydrated: collapsedHydrated,
  } = useLocalStorage<boolean>(SIDEBAR.collapsedStorageKey, false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // A stale or hand-edited localStorage value must never break the shell.
  const safeMode: SidebarMode = isSidebarMode(mode) ? mode : "pinned";

  const setMode = useCallback(
    (next: SidebarMode) => {
      setModeValue(next);
      // Walking out of `pinned` leaves nothing to expand, so reset the toggle.
      if (next !== "pinned") setCollapsed(false);
    },
    [setModeValue, setCollapsed],
  );

  const cycleMode = useCallback(() => {
    const index = SIDEBAR_MODE_ORDER.indexOf(safeMode);
    const next = SIDEBAR_MODE_ORDER[(index + 1) % SIDEBAR_MODE_ORDER.length];
    if (next === "pinned") {
      // Land pinned *expanded* so the cycle is visibly reversible.
      setCollapsed(false);
      setModeValue(next);
      return;
    }
    setMode(next);
  }, [safeMode, setMode, setModeValue, setCollapsed]);

  const toggleCollapsed = useCallback(
    () => setCollapsed((current) => !current),
    [setCollapsed],
  );

  const value = useMemo<SidebarContextValue>(
    () => ({
      mode: safeMode,
      setMode,
      cycleMode,
      collapsed,
      setCollapsed,
      toggleCollapsed,
      mobileOpen,
      setMobileOpen,
      hydrated: modeHydrated && collapsedHydrated,
    }),
    [
      safeMode,
      setMode,
      cycleMode,
      collapsed,
      setCollapsed,
      toggleCollapsed,
      mobileOpen,
      modeHydrated,
      collapsedHydrated,
    ],
  );

  return (
    <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used inside a SidebarProvider");
  }
  return context;
}
