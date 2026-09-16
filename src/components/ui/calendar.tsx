"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  addDaysUtc,
  addMonthsUtc,
  buildMonthDays,
  formatDayLabel,
  formatMonthLabel,
  fromIsoDay,
  isWeekend,
  startOfMonthUtc,
  toIsoDay,
  WEEKDAY_SHORT,
} from "@/lib/date";
import { cn } from "@/lib/utils";

export interface CalendarValue {
  from: string | null;
  to: string | null;
}

interface CalendarProps {
  /** `range` needs two clicks; `single` commits on the first. */
  mode?: "single" | "range";
  value: CalendarValue;
  onChange: (value: CalendarValue) => void;
  /** Controlled month, held as a date-only string. */
  month: string;
  onMonthChange: (month: string) => void;
  min?: string | null;
  max?: string | null;
  /**
   * Passed in rather than read from the clock, so the server and the first
   * client render agree. `null` until the client knows the real date.
   */
  today: string | null;
  className?: string;
  footer?: ReactNode;
}

function isOutOfBounds(iso: string, min?: string | null, max?: string | null) {
  if (min && iso < min) return true;
  if (max && iso > max) return true;
  return false;
}

/**
 * A month grid built from scratch.
 *
 * Deliberately not `<input type="date">`: the native control cannot be themed,
 * announces itself differently in every browser, and offers no range preview.
 * This is the whole calendar — arrows, keyboard, range band — in one component.
 */
export function Calendar({
  mode = "single",
  value,
  onChange,
  month,
  onMonthChange,
  min,
  max,
  today,
  className,
  footer,
}: CalendarProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState<string>(
    value.from ?? today ?? toIsoDay(startOfMonthUtc(month)),
  );
  const [hovered, setHovered] = useState<string | null>(null);

  const days = useMemo(() => buildMonthDays(month), [month]);
  const monthOf = (iso: string) => iso.slice(0, 7);

  /** Ordered bounds of the highlight band, including the live hover preview. */
  const [lo, hi] = useMemo<[string | null, string | null]>(() => {
    const from = value.from;
    const to = value.to ?? (from && hovered ? hovered : null);
    if (!from) return [null, null];
    if (!to) return [from, from];
    return from <= to ? [from, to] : [to, from];
  }, [value.from, value.to, hovered]);

  const select = useCallback(
    (iso: string) => {
      setFocused(iso);
      if (mode === "single") {
        onChange({ from: iso, to: null });
        return;
      }

      const { from, to } = value;
      // First click, or the start of a new range after a completed one.
      if (!from || to) {
        onChange({ from: iso, to: null });
        return;
      }
      onChange(iso < from ? { from: iso, to: from } : { from, to: iso });
    },
    [mode, onChange, value],
  );

  const moveFocus = useCallback(
    (iso: string) => {
      setFocused(iso);
      if (monthOf(iso) !== monthOf(month)) onMonthChange(startOfMonthUtc(iso).toISOString());
      const selector = `[data-day="${iso}"]`;
      requestAnimationFrame(() => {
        gridRef.current?.querySelector<HTMLButtonElement>(selector)?.focus();
      });
    },
    [month, onMonthChange],
  );

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const offsets: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };

    if (event.key in offsets) {
      event.preventDefault();
      let next = addDaysUtc(focused, offsets[event.key]);
      // Skip over days the caller has disabled rather than parking on them.
      for (let guard = 0; guard < 7; guard += 1) {
        if (!isOutOfBounds(next, min, max)) break;
        next = addDaysUtc(next, offsets[event.key]);
      }
      moveFocus(next);
      return;
    }

    if (event.key === "PageUp" || event.key === "PageDown") {
      event.preventDefault();
      const delta = event.key === "PageUp" ? -1 : 1;
      moveFocus(toIsoDay(addMonthsUtc(focused, delta)));
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      moveFocus(addDaysUtc(focused, -((fromIsoDay(focused).getUTCDay() + 6) % 7)));
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      moveFocus(addDaysUtc(focused, 6 - ((fromIsoDay(focused).getUTCDay() + 6) % 7)));
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (!isOutOfBounds(focused, min, max)) select(focused);
    }
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-center justify-between gap-2">
        <span aria-live="polite" className="text-[13px] font-medium text-ink">
          {formatMonthLabel(month)}
        </span>

        <span className="flex items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Previous month"
            onClick={() => onMonthChange(toIsoDay(addMonthsUtc(month, -1)))}
          >
            <ChevronLeft />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Next month"
            onClick={() => onMonthChange(toIsoDay(addMonthsUtc(month, 1)))}
          >
            <ChevronRight />
          </Button>
        </span>
      </div>

      <div
        role="grid"
        aria-label="Calendar"
        ref={gridRef}
        onKeyDown={onKeyDown}
        onMouseLeave={() => setHovered(null)}
        className="flex flex-col gap-1"
      >
        <div role="row" className="grid grid-cols-7">
          {WEEKDAY_SHORT.map((label) => (
            <span
              key={label}
              role="columnheader"
              className="pb-1 text-center font-mono text-[10px] tracking-[0.08em] text-ink-3 uppercase"
            >
              {label}
            </span>
          ))}
        </div>

        <div role="rowgroup" className="flex flex-col gap-1">
          {Array.from({ length: 6 }, (_, row) => (
            <div role="row" key={row} className="grid grid-cols-7">
              {days.slice(row * 7, row * 7 + 7).map((iso) => {
                const disabled = isOutOfBounds(iso, min, max);
                const outside = monthOf(iso) !== monthOf(month);
                const inRange = lo !== null && hi !== null && iso >= lo && iso <= hi;
                const isStart = lo !== null && iso === lo;
                const isEnd = hi !== null && iso === hi;
                const edge = isStart || isEnd;

                return (
                  <div
                    key={iso}
                    role="gridcell"
                    aria-selected={edge}
                    className={cn(
                      "flex items-center justify-center",
                      inRange && "bg-surface-3",
                      inRange && isStart && "rounded-l-full",
                      inRange && isEnd && "rounded-r-full",
                    )}
                  >
                    <button
                      type="button"
                      data-day={iso}
                      disabled={disabled}
                      tabIndex={focused === iso ? 0 : -1}
                      aria-label={formatDayLabel(iso, { weekday: "long" })}
                      aria-current={iso === today ? "date" : undefined}
                      onMouseEnter={() => mode === "range" && setHovered(iso)}
                      onClick={() => select(iso)}
                      className={cn(
                        "flex size-8 items-center justify-center rounded-full text-[12.5px] tnum",
                        "transition-colors duration-150 ease-soft outline-none",
                        "disabled:cursor-not-allowed disabled:text-ink-3/40 disabled:line-through",
                        edge
                          ? "bg-ink font-medium text-canvas"
                          : cn(
                              "text-ink hover:bg-surface-2",
                              outside && "text-ink-3",
                              isWeekend(iso) && !outside && "text-ink-2",
                            ),
                        focused === iso && !edge && "ring-1 ring-ink/25",
                      )}
                      onFocus={() => setFocused(iso)}
                    >
                      {fromIsoDay(iso).getUTCDate()}
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {footer ? (
        <div className="flex items-center justify-between gap-2 border-t border-line pt-3">
          {footer}
        </div>
      ) : null}
    </div>
  );
}
