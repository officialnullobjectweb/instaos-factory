"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";

import { ShortcutHintsDialog } from "@/components/feedback/shortcut-hints";
import { getNavItemByShortcut } from "@/lib/navigation";
import {
  GO_TO_SEQUENCE_PREFIX,
  SEQUENCE_TIMEOUT_MS,
  isModKey,
} from "@/lib/shortcuts";
import { isEditableTarget } from "@/lib/utils";
import { useSidebar } from "@/providers/sidebar-provider";
import { useTheme } from "@/providers/theme-provider";
import { useUIStore } from "@/store/ui-store";

/**
 * Mounts every global shortcut exactly once for the workspace shell:
 * ⌘K command search, ⌘B sidebar, T theme, "/" search focus, "g"+key navigation,
 * "?" help.
 */
export function KeyboardShortcutsProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { toggleCollapsed } = useSidebar();
  const { toggle: toggleTheme } = useTheme();
  const sequenceArmed = useRef(false);
  const sequenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function clearSequence() {
      sequenceArmed.current = false;
      if (sequenceTimer.current) {
        clearTimeout(sequenceTimer.current);
        sequenceTimer.current = null;
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      const state = useUIStore.getState();

      if (event.key === "Escape") {
        clearSequence();
      }

      if (isModKey(event) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        state.toggleCommand();
        return;
      }

      if (isModKey(event) && event.key.toLowerCase() === "b") {
        event.preventDefault();
        toggleCollapsed();
        return;
      }

      if (isEditableTarget(event.target) || event.metaKey || event.ctrlKey) return;

      if (event.key === "?") {
        event.preventDefault();
        state.setShortcutsOpen(true);
        return;
      }

      if (event.key === "/") {
        event.preventDefault();
        document
          .querySelector<HTMLInputElement>("[data-search-input]")
          ?.focus();
        return;
      }

      const key = event.key.toLowerCase();

      // Theme has no button: `T` is the only way to switch, as specified.
      if (key === "t") {
        event.preventDefault();
        toggleTheme();
        return;
      }

      if (sequenceArmed.current) {
        const item = getNavItemByShortcut(key);
        clearSequence();
        if (item) {
          event.preventDefault();
          router.push(item.href);
        }
        return;
      }

      if (key === GO_TO_SEQUENCE_PREFIX) {
        sequenceArmed.current = true;
        sequenceTimer.current = setTimeout(clearSequence, SEQUENCE_TIMEOUT_MS);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      clearSequence();
    };
  }, [router, toggleCollapsed, toggleTheme]);

  return (
    <>
      {children}
      <ShortcutHintsDialog />
    </>
  );
}
