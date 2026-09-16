import type { ShortcutDefinition } from "@/types/navigation";

export const SHORTCUTS: ShortcutDefinition[] = [
  {
    id: "command-palette",
    label: "Open command search",
    display: ["⌘", "K"],
    aria: "Meta+K Control+K",
  },
  {
    id: "cycle-sidebar",
    label: "Change sidebar behaviour",
    display: ["⌘", "B"],
    aria: "Meta+B Control+B",
  },
  {
    id: "toggle-theme",
    label: "Switch light / dark",
    display: ["T"],
    aria: "T",
  },
  {
    id: "focus-search",
    label: "Focus page search",
    display: ["/"],
    aria: "/",
  },
  {
    id: "go-to",
    label: "Go to page",
    display: ["G", "then key"],
    aria: "G",
  },
  {
    id: "shortcuts",
    label: "Show shortcuts",
    display: ["?"],
    aria: "Shift+Slash",
  },
  {
    id: "escape",
    label: "Close overlay",
    display: ["Esc"],
    aria: "Escape",
  },
];

/**
 * Active only while the content queue is mounted — see `useQueueShortcuts`.
 * They are listed alongside the global set so the reference stays the single
 * place anyone has to look.
 */
export const QUEUE_SHORTCUTS: ShortcutDefinition[] = [
  {
    id: "queue-approve",
    label: "Approve the focused post",
    display: ["A"],
    aria: "A",
  },
  {
    id: "queue-reject",
    label: "Reject with a note",
    display: ["R"],
    aria: "R",
  },
  {
    id: "queue-move",
    label: "Move between posts",
    display: ["J", "K"],
    aria: "J",
  },
  {
    id: "queue-open",
    label: "Open the review drawer",
    display: ["↵"],
    aria: "Enter",
  },
];

export const GO_TO_SEQUENCE_PREFIX = "g";

/** Milliseconds a "g" press stays armed before the sequence resets. */
export const SEQUENCE_TIMEOUT_MS = 1400;

export function isModKey(event: KeyboardEvent) {
  return event.metaKey || event.ctrlKey;
}
