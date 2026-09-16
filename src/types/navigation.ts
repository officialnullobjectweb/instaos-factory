import type { LucideIcon } from "lucide-react";

export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  /** Single key pressed after the "g" prefix, Linear-style. */
  shortcutKey: string;
  description: string;
}

export interface NavSection {
  id: string;
  label: string;
  items: NavItem[];
}

export interface ShortcutDefinition {
  id: string;
  label: string;
  /** Rendered key chips, e.g. ["⌘", "K"]. */
  display: string[];
  /** aria-keyshortcuts value. */
  aria: string;
}

export interface CommandAction {
  id: string;
  label: string;
  description?: string;
  /** Navigates when present. */
  href?: string;
  /** Otherwise, a shell command the palette knows how to run. */
  command?: "generate";
  icon: LucideIcon;
  group: string;
  keywords: string[];
}
