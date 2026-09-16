"use client";

import { useEffect, useMemo } from "react";

import { useNotificationStore } from "@/store/notification-store";

/**
 * Client access to the derived notification feed.
 *
 * The first call fetches from `GET /api/notifications`; the feed can be
 * re-derived on demand via `refresh` (the bell does this when it opens).
 */
export function useNotifications() {
  const items = useNotificationStore((state) => state.items);
  const loaded = useNotificationStore((state) => state.loaded);
  const refresh = useNotificationStore((state) => state.refresh);
  const markRead = useNotificationStore((state) => state.markRead);
  const markAllRead = useNotificationStore((state) => state.markAllRead);
  const dismiss = useNotificationStore((state) => state.dismiss);

  useEffect(() => {
    if (!loaded) void refresh();
  }, [loaded, refresh]);

  const unreadCount = useMemo(
    () => items.filter((item) => !item.read).length,
    [items],
  );

  return { items, unreadCount, markRead, markAllRead, dismiss, refresh } as const;
}
