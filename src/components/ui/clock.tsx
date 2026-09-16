"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

const CLOCK_STORAGE_KEY = "factory-os.clock-24h";

/**
 * Live wall clock for the command bar.
 *
 * Two deliberate choices:
 * - Nothing renders until the first client tick, because the server cannot know
 *   what time it is where the reader is. A dash placeholder holds the layout.
 * - The 12/24-hour format is ours, not the OS locale's — the whole product is
 *   tabular and monospaced here, and a locale flip mid-session reads as a bug.
 */
export function Clock({ className }: { className?: string }) {
  const [now, setNow] = useState<Date | null>(null);
  const [use24Hour, setUse24Hour] = useState(true);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(CLOCK_STORAGE_KEY);
    if (stored === "false") setUse24Hour(false);

    setNow(new Date());

    // Re-align to the second boundary so the display never skips a tick.
    const align = setTimeout(() => {
      setNow(new Date());
      timer.current = setInterval(() => setNow(new Date()), 1000);
    }, 1000 - (Date.now() % 1000));

    return () => {
      clearTimeout(align);
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  function toggleFormat() {
    setUse24Hour((current) => {
      const next = !current;
      window.localStorage.setItem(CLOCK_STORAGE_KEY, String(next));
      return next;
    });
  }

  const time = now
    ? new Intl.DateTimeFormat("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: !use24Hour,
      }).format(now)
    : "--:--:--";

  const zone = now
    ? new Intl.DateTimeFormat("en-US", { timeZoneName: "short" })
        .formatToParts(now)
        .find((part) => part.type === "timeZoneName")?.value ?? ""
    : "";

  const full = now
    ? new Intl.DateTimeFormat("en-US", {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: !use24Hour,
      }).format(now)
    : "Loading time";

  return (
    <button
      type="button"
      onClick={toggleFormat}
      title={`${full} — click for ${use24Hour ? "12" : "24"}-hour time`}
      aria-label={`Local time ${full}. Switch to ${use24Hour ? "12" : "24"}-hour clock.`}
      className={cn(
        "flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 font-mono text-[11.5px] text-ink-2 tnum",
        "transition-colors duration-150 ease-soft hover:border-line-strong hover:text-ink",
        "active:scale-[0.97] motion-reduce:active:scale-100",
        className,
      )}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-success" />
      {time}
      {zone ? (
        <span aria-hidden="true" className="text-ink-3">
          {zone}
        </span>
      ) : null}
    </button>
  );
}
