"use client";

import { create } from "zustand";

import type { NotificationItem } from "@/types";

/**
 * Notification centre state.
 *
 * Items come from `GET /api/notifications`, which derives the feed from real
 * state at read time (pending reviews, publish failures, fresh publishes).
 * Read/dismiss are client-side views over that feed — there is no
 * notifications table to keep in sync, so a refresh always shows the truth.
 */
interface NotificationState {
  items: NotificationItem[];
  loaded: boolean;
  refresh: () => Promise<void>;
  markRead: (id: string) => void;
  markAllRead: () => void;
  dismiss: (id: string) => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  items: [],
  loaded: false,

  refresh: async () => {
    try {
      const response = await fetch("/api/notifications");
      if (!response.ok) return;
      const data = (await response.json()) as { notifications: NotificationItem[] };
      set({ items: data.notifications, loaded: true });
    } catch {
      // transient — the bell simply keeps what it has
    }
  },

  markRead: (id) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id ? { ...item, read: true } : item,
      ),
    })),

  markAllRead: () =>
    set((state) => ({
      items: state.items.map((item) => ({ ...item, read: true })),
    })),

  dismiss: (id) =>
    set((state) => ({
      items: state.items.filter((item) => item.id !== id),
    })),
}));
