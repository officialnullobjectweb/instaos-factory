"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { EASE, durations } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * The one expand/collapse primitive.
 *
 * Built here rather than reached for from the browser because the animation, the
 * easing and the focus behaviour are part of the design system — and because three
 * places need it (an expanded queue row, a card section, a run's step list) with
 * identical timing. Height animates from `0` to `auto`, which framer measures, so
 * nothing has to know how tall its content is.
 */
export function Disclosure({
  open,
  children,
  className,
  id,
}: {
  open: boolean;
  children: ReactNode;
  className?: string;
  /** Wired to the trigger's `aria-controls` so the pair is announced together. */
  id?: string;
}) {
  return (
    <AnimatePresence initial={false}>
      {open ? (
        <motion.div
          key="disclosure"
          id={id}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: durations.base, ease: EASE }}
          className={cn("overflow-hidden", className)}
        >
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

/**
 * The chevron that drives a `Disclosure`.
 *
 * `aria-expanded` and `aria-controls` are set from the same state the content
 * uses, so a screen reader gets the relationship without the caller wiring it.
 */
export function DisclosureButton({
  open,
  onToggle,
  label,
  controls,
  className,
  size = "icon-sm",
}: {
  open: boolean;
  onToggle: () => void;
  label: string;
  controls?: string;
  className?: string;
  size?: "icon-sm" | "xs";
}) {
  return (
    <Button
      type="button"
      size={size}
      variant="ghost"
      aria-expanded={open}
      aria-controls={controls}
      aria-label={label}
      title={label}
      onClick={onToggle}
      className={cn("text-ink-3 hover:text-ink", className)}
    >
      <ChevronRight
        className={cn(
          "transition-transform duration-200 ease-soft",
          open && "rotate-90",
        )}
      />
    </Button>
  );
}
