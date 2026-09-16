"use client";

import { Check } from "lucide-react";
import { useRef, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface OptionCard<T extends string> {
  value: T;
  label: string;
  description?: string;
  /** Optional miniature of the effect, rendered on the right of the card. */
  preview?: ReactNode;
}

interface OptionCardsProps<T extends string> {
  value: T;
  options: OptionCard<T>[];
  onValueChange: (value: T) => void;
  /** Group label, announced to screen readers as the radiogroup name. */
  label: string;
  className?: string;
}

/**
 * Mutually exclusive choices that each need a line of explanation.
 *
 * A `Select` hides the alternatives behind a click, which is wrong when the
 * differences are the point. These are real radios for assistive tech, with the
 * arrow-key behaviour a radio group is expected to have.
 */
export function OptionCards<T extends string>({
  value,
  options,
  onValueChange,
  label,
  className,
}: OptionCardsProps<T>) {
  const refs = useRef(new Map<string, HTMLButtonElement>());

  function move(from: number, delta: number) {
    const next = options[(from + delta + options.length) % options.length];
    onValueChange(next.value);
    refs.current.get(next.value)?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("flex w-full flex-col gap-2", className)}
    >
      {options.map((option, index) => {
        const selected = option.value === value;

        return (
          <button
            key={option.value}
            ref={(node) => {
              if (node) refs.current.set(option.value, node);
              else refs.current.delete(option.value);
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onValueChange(option.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown" || event.key === "ArrowRight") {
                event.preventDefault();
                move(index, 1);
              }
              if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
                event.preventDefault();
                move(index, -1);
              }
            }}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg border px-3.5 py-3 text-left",
              "transition-colors duration-150 ease-soft outline-none",
              selected
                ? "border-ink/25 bg-surface-2"
                : "border-line bg-surface hover:bg-surface-2",
            )}
          >
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-[13px] font-medium text-ink">{option.label}</span>
              {option.description ? (
                <span className="text-[12px] leading-relaxed text-ink-2">
                  {option.description}
                </span>
              ) : null}
            </span>

            {option.preview ? (
              <span className="hidden shrink-0 sm:block">{option.preview}</span>
            ) : null}

            <span
              aria-hidden="true"
              className={cn(
                "flex size-4.5 shrink-0 items-center justify-center rounded-full border",
                selected ? "border-ink bg-ink text-canvas" : "border-line-strong",
              )}
            >
              {selected ? <Check className="size-3" /> : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
