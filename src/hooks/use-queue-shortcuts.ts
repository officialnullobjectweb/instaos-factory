"use client";

import { useEffect } from "react";

const EDITABLE_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

/** True when keystrokes should be treated as text, not as commands. */
function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return EDITABLE_TAGS.has(target.tagName);
}

interface QueueShortcutsOptions {
  /** Turned off while a confirmation dialog owns the keyboard. */
  enabled?: boolean;
  onApprove: () => void;
  onReject: () => void;
  onMoveFocus: (direction: -1 | 1) => void;
  onOpen: () => void;
  onClose?: () => void;
  onSelectAll?: () => void;
}

/**
 * Reviewer keyboard controls: `A` approve, `R` request changes, `J`/`K` move the
 * focused row, `Enter` open the review drawer, `Esc` close it.
 *
 * Bound to the queue while it is mounted rather than globally, so these letters
 * keep their normal meaning on every other page.
 */
export function useQueueShortcuts({
  enabled = true,
  onApprove,
  onReject,
  onMoveFocus,
  onOpen,
  onClose,
  onSelectAll,
}: QueueShortcutsOptions) {
  useEffect(() => {
    if (!enabled) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;

      switch (event.key.toLowerCase()) {
        case "a":
          event.preventDefault();
          onApprove();
          return;
        case "r":
          event.preventDefault();
          onReject();
          return;
        case "j":
          event.preventDefault();
          onMoveFocus(1);
          return;
        case "k":
          event.preventDefault();
          onMoveFocus(-1);
          return;
        case "enter":
          event.preventDefault();
          onOpen();
          return;
        case "escape":
          onClose?.();
          return;
        case "*":
          if (!onSelectAll) return;
          event.preventDefault();
          onSelectAll();
          return;
        default:
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled, onApprove, onReject, onMoveFocus, onOpen, onClose, onSelectAll]);
}
