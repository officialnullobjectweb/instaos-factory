"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { MOCK_NOW } from "@/data/time";
import {
  fetchSchedule,
  rescheduleSlot,
  retrySlot,
  runSchedulerTick,
  schedulePost,
  withdrawSlot,
} from "@/lib/api/schedule-client";
import { toast } from "@/lib/toast";
import type { ScheduleEntry } from "@/types";

/**
 * Client state for the publishing pipeline.
 *
 * The mock world is anchored to MOCK_NOW, so "due" is computed against that
 * instant everywhere; the API still validates against the real clock.
 */
export function useSchedule() {
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyIds, setBusyIds] = useState<string[]>([]);

  const load = useCallback(async () => {
    try {
      const next = await fetchSchedule();
      setEntries(next);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load slots");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const markBusy = (id: string, busy: boolean) =>
    setBusyIds((current) =>
      busy ? [...new Set([...current, id])] : current.filter((item) => item !== id),
    );

  const book = useCallback(
    async (input: { postId: string; scheduledFor: string; igPage?: string }) => {
      try {
        const entry = await schedulePost(input);
        setEntries((current) => [entry, ...current]);
        toast.success("Slot booked", {
          description: "The post will publish automatically at the chosen time.",
        });
        return entry;
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not book slot");
        return null;
      }
    },
    [],
  );

  const move = useCallback(async (id: string, scheduledFor: string) => {
    markBusy(id, true);
    try {
      const entry = await rescheduleSlot(id, scheduledFor);
      setEntries((current) =>
        current.map((item) => (item.id === id ? entry : item)),
      );
      toast.success("Slot moved");
      return entry;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not move slot");
      await load();
      return null;
    } finally {
      markBusy(id, false);
    }
  }, [load]);

  const withdraw = useCallback(
    async (id: string) => {
      markBusy(id, true);
      try {
        await withdrawSlot(id);
        setEntries((current) => current.filter((item) => item.id !== id));
        toast.success("Slot withdrawn", {
          description: "The post is back in the queue as approved.",
        });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not withdraw");
      } finally {
        markBusy(id, false);
      }
    },
    [],
  );

  const retry = useCallback(async (id: string) => {
    markBusy(id, true);
    try {
      const entry = await retrySlot(id);
      setEntries((current) =>
        current.map((item) => (item.id === id ? entry : item)),
      );
      toast.success("Retry scheduled", {
        description: "The slot re-enters the queue and runs in the next tick.",
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not retry");
    } finally {
      markBusy(id, false);
    }
  }, []);

  const tick = useCallback(async () => {
    try {
      const result = await runSchedulerTick();
      await load();
      if (result.processed === 0) {
        toast.info("Nothing due", {
          description: "No slots reached their posting time yet.",
        });
      } else {
        toast.success(
          `Published ${result.published}, failed ${result.failed}`,
          { description: `${result.processed} due slot(s) processed.` },
        );
      }
      return result;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Scheduler tick failed");
      return null;
    }
  }, [load]);

  /** Queue buckets for the publishing board, newest first inside each. */
  const buckets = useMemo(() => {
    const byTime = (a: ScheduleEntry, b: ScheduleEntry) =>
      new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime();

    const now = MOCK_NOW.getTime();
    return {
      upcoming: entries
        .filter((entry) => entry.status === "scheduled")
        .sort(byTime),
      publishing: entries.filter((entry) => entry.status === "publishing"),
      published: entries
        .filter(
          (entry) =>
            entry.status === "published" &&
            now - new Date(entry.publishedAt ?? 0).getTime() < 24 * 60 * 60_000,
        )
        .sort(byTime),
      failed: entries
        .filter((entry) => entry.status === "failed")
        .sort(byTime),
    };
  }, [entries]);

  return {
    entries,
    loading,
    busyIds,
    buckets,
    book,
    move,
    withdraw,
    retry,
    tick,
    reload: load,
  };
}

export type ScheduleController = ReturnType<typeof useSchedule>;
