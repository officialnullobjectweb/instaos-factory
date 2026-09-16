"use client";

import { useEffect, useRef } from "react";

import { usePostsStore } from "@/store/posts-store";

/**
 * Hydrates the client post store from the real API on mount.
 *
 * The store starts empty (there is no bundled dataset to seed from) and every
 * page that renders posts — dashboard, queue, schedule, calendar preview —
 * reads through the same store, so one fetch here covers the whole workspace.
 * Guards against double-fire under React strict mode.
 */
export function WorkspaceHydration({ children }: { children: React.ReactNode }) {
  const refresh = usePostsStore((state) => state.refresh);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void refresh().catch(() => undefined);
  }, [refresh]);

  return <>{children}</>;
}
