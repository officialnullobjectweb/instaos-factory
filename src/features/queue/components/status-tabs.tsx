"use client";

import { useMemo } from "react";

import { CONTENT_STATUS_META, STATUS_ORDER } from "@/lib/status";
import { cn } from "@/lib/utils";
import type { ContentStatus, Post } from "@/types";

interface StatusTabsProps {
  posts: Post[];
  /** The active status filter, or "all". */
  value: ContentStatus | "all";
  onChange: (value: ContentStatus | "all") => void;
}

/**
 * Pipeline overview and status filter in one control: the count on each tab is
 * the work still sitting in that state, so the strip doubles as a health read.
 */
export function StatusTabs({ posts, value, onChange }: StatusTabsProps) {
  const counts = useMemo(() => {
    const map = new Map<ContentStatus, number>();

    for (const post of posts) {
      map.set(post.status, (map.get(post.status) ?? 0) + 1);
    }

    return map;
  }, [posts]);

  const tabs: Array<{ id: ContentStatus | "all"; label: string; count: number }> = [
    { id: "all", label: "All posts", count: posts.length },
    ...STATUS_ORDER.map((status) => ({
      id: status as ContentStatus | "all",
      label: CONTENT_STATUS_META[status].label,
      count: counts.get(status) ?? 0,
    })),
  ];

  return (
    <div
      role="tablist"
      aria-label="Filter by status"
      className="scrollbar-slim flex items-center gap-1 overflow-x-auto pb-0.5"
    >
      {tabs.map((tab) => {
        const active = tab.id === value;

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors duration-150 ease-soft outline-none",
              active
                ? "bg-surface text-ink shadow-card"
                : "text-ink-2 hover:bg-surface-2 hover:text-ink",
            )}
          >
            {tab.label}
            <span
              className={cn(
                "rounded-full px-1.5 text-[11px] tnum",
                active ? "bg-surface-2 text-ink" : "text-ink-3",
              )}
            >
              {tab.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
