"use client";

import { useEffect, useState } from "react";

import { toIsoDay } from "@/lib/date";

/**
 * The client's real date, as `YYYY-MM-DD`.
 *
 * Returns `null` until the first effect runs: the server has no idea what day
 * it is where the reader is, so components render a neutral state first and
 * light up "today" once the browser confirms it. That keeps hydration honest
 * instead of guessing and correcting.
 */
export function useTodayIso() {
  const [today, setToday] = useState<string | null>(null);

  useEffect(() => {
    setToday(toIsoDay(new Date()));

    // Crossing midnight while a tab sits open is common in a scheduling tool.
    const timer = setInterval(() => setToday(toIsoDay(new Date())), 60_000);
    return () => clearInterval(timer);
  }, []);

  return today;
}
