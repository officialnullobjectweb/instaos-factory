"use client";

import { Calendar as CalendarIcon, X } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Calendar, type CalendarValue } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useTodayIso } from "@/hooks/use-today";
import { addDaysUtc, formatDayLabel, startOfMonthUtc } from "@/lib/date";
import { cn } from "@/lib/utils";

interface PickerRootProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: string;
  display: string;
  empty: boolean;
  className?: string;
  onClear?: () => void;
  children: ReactNode;
}

/**
 * Trigger + popover shell shared by both pickers.
 *
 * The clear affordance is a sibling of the trigger rather than a control nested
 * inside it — a button inside a button is not a thing the DOM allows, and screen
 * readers flatten it into something unusable.
 */
function PickerRoot({
  open,
  onOpenChange,
  label,
  display,
  empty,
  className,
  onClear,
  children,
}: PickerRootProps) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <span className="relative inline-flex min-w-0">
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={label}
            className={cn(
              "flex h-8 min-w-0 items-center gap-2 rounded-full border border-line bg-surface px-3 text-[12.5px]",
              "transition-colors duration-150 ease-soft hover:border-line-strong active:scale-[0.99]",
              "focus-visible:outline-none motion-reduce:active:scale-100",
              empty ? "text-ink-3" : "text-ink",
              onClear && !empty && "pr-6",
              className,
            )}
          >
            <CalendarIcon className="size-3.5 shrink-0 text-ink-3" aria-hidden="true" />
            <span className="truncate whitespace-nowrap tnum">{display}</span>
          </button>
        </PopoverTrigger>

        {onClear && !empty ? (
          <button
            type="button"
            aria-label={`Clear ${label}`}
            onClick={onClear}
            className="absolute top-1/2 right-1 -translate-y-1/2 rounded-full p-0.5 text-ink-3 transition-colors duration-150 ease-soft hover:bg-surface-2 hover:text-ink"
          >
            <X className="size-3" />
          </button>
        ) : null}
      </span>

      {children}
    </Popover>
  );
}

interface DatePickerProps {
  value: string | null;
  onChange: (value: string | null) => void;
  label: string;
  placeholder?: string;
  min?: string | null;
  max?: string | null;
  className?: string;
}

/** Single-day picker: one click commits and closes. */
export function DatePicker({
  value,
  onChange,
  label,
  placeholder = "Pick a date",
  min,
  max,
  className,
}: DatePickerProps) {
  const today = useTodayIso();
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState<string>(
    () => startOfMonthUtc(value ?? today ?? "2026-09-01").toISOString(),
  );

  return (
    <PickerRoot
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setMonth(startOfMonthUtc(value ?? today ?? "2026-09-01").toISOString());
      }}
      label={label}
      empty={value === null}
      display={value ? formatDayLabel(value) : placeholder}
      className={className}
      onClear={() => onChange(null)}
    >
      <PopoverContent align="start" className="w-[19.5rem]">
        <Calendar
          mode="single"
          today={today}
          month={month}
          onMonthChange={setMonth}
          value={{ from: value, to: null }}
          onChange={(next) => {
            onChange(next.from);
            setOpen(false);
          }}
          min={min}
          max={max}
          footer={
            <>
              <Button
                variant="ghost"
                size="xs"
                disabled={!today}
                onClick={() => {
                  if (today) onChange(today);
                  setOpen(false);
                }}
              >
                Today
              </Button>
              <Button variant="ghost" size="xs" onClick={() => setOpen(false)}>
                Done
              </Button>
            </>
          }
        />
      </PopoverContent>
    </PickerRoot>
  );
}

interface DateRangePickerProps {
  value: CalendarValue;
  onChange: (value: CalendarValue) => void;
  label: string;
  placeholder?: string;
  /** Relative shortcuts in the footer, counted back from today. */
  presets?: number[];
  className?: string;
}

/** Range picker: two clicks, with a live band preview and preset shortcuts. */
export function DateRangePicker({
  value,
  onChange,
  label,
  placeholder = "Any date",
  presets = [7, 30],
  className,
}: DateRangePickerProps) {
  const today = useTodayIso();
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState<string>(
    () => startOfMonthUtc(value.from ?? today ?? "2026-09-01").toISOString(),
  );

  const display =
    value.from && value.to
      ? `${formatDayLabel(value.from, { year: undefined })} – ${formatDayLabel(value.to)}`
      : value.from
        ? `From ${formatDayLabel(value.from, { year: undefined })}`
        : placeholder;

  const awaitingSecondClick = Boolean(value.from) && !value.to;

  return (
    <PickerRoot
      open={open}
      onOpenChange={setOpen}
      label={label}
      empty={!value.from}
      display={display}
      className={cn(className, awaitingSecondClick && "border-ink/30")}
      onClear={() => onChange({ from: null, to: null })}
    >
      <PopoverContent align="start" className="w-[19.5rem]">
        <Calendar
          mode="range"
          today={today}
          month={month}
          onMonthChange={setMonth}
          value={value}
          onChange={onChange}
          footer={
            <>
              <span className="flex items-center gap-1">
                {presets.map((days) => (
                  <Button
                    key={days}
                    variant="ghost"
                    size="xs"
                    disabled={!today}
                    onClick={() => {
                      if (!today) return;
                      onChange({ from: addDaysUtc(today, -(days - 1)), to: today });
                    }}
                  >
                    {days}d
                  </Button>
                ))}
              </span>
              <span className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => onChange({ from: null, to: null })}
                >
                  Clear
                </Button>
                <Button variant="secondary" size="xs" onClick={() => setOpen(false)}>
                  Done
                </Button>
              </span>
            </>
          }
        />
      </PopoverContent>
    </PickerRoot>
  );
}
