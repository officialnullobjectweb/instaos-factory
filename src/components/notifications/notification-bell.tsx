"use client";

import { Bell, CheckCheck, CircleDot, Inbox } from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getBrand } from "@/data/brands";
import { useNotifications } from "@/hooks/use-notifications";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export function NotificationBell() {
  const { items, unreadCount, markRead, markAllRead } = useNotifications();
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={
            unreadCount > 0
              ? `Notifications, ${unreadCount} unread`
              : "Notifications"
          }
        >
          <Bell />
          {unreadCount > 0 ? (
            <span className="absolute top-1.5 right-1.5 flex size-4 items-center justify-center rounded-full bg-ink text-[9px] font-medium text-canvas tnum">
              {unreadCount}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[380px] p-0" align="end">
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div className="flex items-center gap-2">
            <h2 className="text-[13px] font-medium">Notifications</h2>
            {unreadCount > 0 ? (
              <Badge tone="neutral" size="sm">
                {unreadCount} new
              </Badge>
            ) : null}
          </div>
          <Button
            variant="ghost"
            size="xs"
            onClick={markAllRead}
            disabled={unreadCount === 0}
          >
            <CheckCheck />
            Mark all read
          </Button>
        </header>

        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <Inbox className="size-5 text-ink-3" />
            <p className="text-[13px] text-ink-2">You are all caught up.</p>
          </div>
        ) : (
          <ScrollArea className="max-h-80">
            <ul className="divide-y divide-line">
              {items.map((item) => {
                const brand = item.brandId ? getBrand(item.brandId) : null;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => markRead(item.id)}
                      className={cn(
                        "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors duration-150 ease-soft hover:bg-surface-2",
                        !item.read && "bg-canvas",
                      )}
                    >
                      <span
                        className={cn(
                          "mt-1.5 size-1.5 shrink-0 rounded-full",
                          item.read ? "bg-transparent" : "bg-ink",
                        )}
                        aria-hidden="true"
                      />
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span
                          className={cn(
                            "text-[13px] leading-snug",
                            item.read ? "font-normal text-ink-2" : "font-medium text-ink",
                          )}
                        >
                          {item.title}
                        </span>
                        <span className="text-[12px] leading-relaxed text-ink-2">
                          {item.body}
                        </span>
                        <span className="mt-1 flex items-center gap-2 text-[11px] text-ink-3">
                          <span>{now ? formatRelativeTime(item.timestamp, now) : ""}</span>
                          {brand ? (
                            <>
                              <CircleDot className="size-2.5" />
                              <span>{brand.name}</span>
                            </>
                          ) : null}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  );
}
