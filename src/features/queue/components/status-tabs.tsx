"use client";

import { useMemo } from "react";

import { CONTENT_STATUS_META, STATUS_ORDER } from "@/lib/status";
import { cn } from "@/lib/utils";
import type { ContentStatus, Post } from "@/types";

interface StatusTabsProps {
  posts: Post[];
  value: ContentStatus | "all";
  onChange: (value: ContentStatus | "all") => void;
}

/**
 * Minimal status filter — just the counts, no visual noise.
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
    { id: "all", label: "All", count: posts.length },
    ...STATUS_ORDER.map((status) => ({
      id: status as ContentStatus | "all",
      label: CONTENT_STATUS_META[status].label.split(" ")[0],
      count: counts.get(status) ?? 0,
    })),
  ];

  return (
    <div
      role="tablist"
      aria-label="Filter by status"
      className="scrollbar-slim flex items-center gap-0.5 overflow-x-auto"
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
              "flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[12px] font-medium transition-colors outline-none",
              active
                ? "bg-ink text-canvas"
                : "text-ink-3 hover:bg-surface-2 hover:text-ink",
            )}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={cn(
                "text-[10px] tnum",
                active ? "text-canvas/60" : "text-ink-3",
              )}>
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
