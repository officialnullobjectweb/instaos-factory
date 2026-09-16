import {
  CalendarDays,
  ChartColumn,
  CirclePlus,
  FlaskConical,
  Inbox,
  Layers,
  LayoutDashboard,
  Palette,
  Settings,
} from "lucide-react";

import type { CommandAction, NavItem, NavSection } from "@/types/navigation";

export const NAV_SECTIONS: NavSection[] = [
  {
    id: "workspace",
    label: "Workspace",
    items: [
      {
        id: "dashboard",
        label: "Dashboard",
        href: "/",
        icon: LayoutDashboard,
        shortcutKey: "d",
        description: "Today across all three brands",
      },
      {
        id: "queue",
        label: "Content Queue",
        href: "/queue",
        icon: Inbox,
        shortcutKey: "q",
        description: "Review, approve and reject drafts",
      },
      {
        id: "studio",
        label: "Design Studio",
        href: "/studio",
        icon: Palette,
        shortcutKey: "t",
        description: "Render and export carousels",
      },
      {
        id: "templates",
        label: "Templates",
        href: "/templates",
        icon: Layers,
        shortcutKey: "e",
        description: "Reusable creative systems",
      },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    items: [
      {
        id: "experiments",
        label: "Experiments",
        href: "/experiments",
        icon: FlaskConical,
        shortcutKey: "x",
        description: "Sub-niche A/B tests and winners",
      },
      {
        id: "schedule",
        label: "Schedule",
        href: "/schedule",
        icon: CalendarDays,
        shortcutKey: "s",
        description: "Publishing calendar and slots",
      },
      {
        id: "analytics",
        label: "Analytics",
        href: "/analytics",
        icon: ChartColumn,
        shortcutKey: "a",
        description: "Reach, engagement and growth",
      },
    ],
  },
  {
    id: "system",
    label: "System",
    items: [
      {
        id: "settings",
        label: "Settings",
        href: "/settings",
        icon: Settings,
        shortcutKey: ",",
        description: "Workspace, brands and automations",
      },
    ],
  },
];

export const NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap(
  (section) => section.items,
);

export function getNavItemByHref(href: string): NavItem | undefined {
  return NAV_ITEMS.find((item) => item.href === href);
}

export function getNavItemByShortcut(key: string): NavItem | undefined {
  return NAV_ITEMS.find((item) => item.shortcutKey === key);
}

export const COMMAND_ACTIONS: CommandAction[] = [
  {
    id: "action-sync",
    label: "Sync Instagram accounts",
    description: "Pull latest metrics from the Graph API",
    icon: ChartColumn,
    group: "Actions",
    keywords: ["sync", "refresh", "metrics", "instagram"],
  },
  {
    id: "action-generate",
    label: "Generate a post",
    description: "Run the AI pipeline for one brand",
    /** Handled by the palette: opens the generation dialog. */
    command: "generate",
    icon: CirclePlus,
    group: "Actions",
    keywords: ["generate", "ai", "draft", "new", "post"],
  },
  {
    id: "action-review",
    label: "Start review session",
    description: "Open the approval queue in focus mode",
    href: "/queue",
    icon: Inbox,
    group: "Actions",
    keywords: ["review", "approve", "queue"],
  },
  {
    id: "action-export",
    label: "Export performance report",
    description: "Download the weekly CSV summary",
    icon: CalendarDays,
    group: "Actions",
    keywords: ["export", "csv", "report", "weekly"],
  },
];
