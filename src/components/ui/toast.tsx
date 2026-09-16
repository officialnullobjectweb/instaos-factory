"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  CircleAlert,
  CircleCheck,
  Info,
  TriangleAlert,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { EASE } from "@/lib/motion";
import { cn } from "@/lib/utils";
import {
  DEFAULT_TOAST_DURATION,
  MAX_VISIBLE_TOASTS,
  useToastStore,
  type ToastRecord,
  type ToastTone,
} from "@/store/toast-store";

/**
 * The toast stack.
 *
 * Stacked, not listed: the newest toast sits in front and older ones tuck behind
 * it with a small scale and offset, so a burst of events does not cover the page.
 * Hovering (or focusing) the stack expands it into a readable list and pauses
 * every countdown, which is what makes a stack usable rather than merely pretty.
 */

const TONE_META: Record<ToastTone, { icon: LucideIcon; className: string }> = {
  success: { icon: CircleCheck, className: "text-success" },
  error: { icon: CircleAlert, className: "text-danger" },
  warning: { icon: TriangleAlert, className: "text-warning" },
  info: { icon: Info, className: "text-ink-2" },
};

export function ToastStack() {
  const toasts = useToastStore((state) => state.toasts);
  const dismiss = useToastStore((state) => state.dismiss);
  const clear = useToastStore((state) => state.clear);
  const [expanded, setExpanded] = useState(false);

  const visible = toasts.slice(0, MAX_VISIBLE_TOASTS);
  const overflow = toasts.length - visible.length;

  return (
    <div
      role="region"
      aria-label="Notifications"
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      onFocusCapture={() => setExpanded(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setExpanded(false);
        }
      }}
      className="pointer-events-none fixed right-4 bottom-4 z-[80] flex w-[min(24rem,calc(100vw-2rem))] flex-col items-end gap-2"
    >
      <AnimatePresence initial={false} mode="popLayout">
        {visible.map((toast, index) => (
          <ToastCard
            key={toast.id}
            toast={toast}
            index={index}
            expanded={expanded}
            onDismiss={() => dismiss(toast.id)}
          />
        ))}
      </AnimatePresence>

      {overflow > 0 ? (
        <button
          type="button"
          onClick={clear}
          className="pointer-events-auto rounded-full border border-line bg-surface px-3 py-1 text-[11.5px] text-ink-2 shadow-card transition-colors duration-150 ease-soft hover:text-ink"
        >
          {overflow} more · clear all
        </button>
      ) : null}
    </div>
  );
}

function ToastCard({
  toast,
  index,
  expanded,
  onDismiss,
}: {
  toast: ToastRecord;
  index: number;
  expanded: boolean;
  onDismiss: () => void;
}) {
  const [paused, setPaused] = useState(false);
  const remaining = useRef(toast.duration || DEFAULT_TOAST_DURATION);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    if (paused || toast.duration === 0) return;

    startedAt.current = Date.now();
    const timeout = setTimeout(onDismiss, remaining.current);
    return () => {
      clearTimeout(timeout);
      remaining.current -= Date.now() - startedAt.current;
    };
  }, [paused, onDismiss, toast.duration]);

  const meta = TONE_META[toast.tone];
  const Icon = meta.icon;
  const depth = expanded ? 0 : index;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{
        opacity: 1,
        // Stacked depth: older cards sit slightly higher and smaller behind the
        // newest one. Expanding flattens them into a list.
        y: expanded ? 0 : depth * -6,
        scale: expanded ? 1 : 1 - depth * 0.03,
      }}
      exit={{ opacity: 0, y: 8, scale: 0.98, transition: { duration: 0.15 } }}
      transition={{ duration: 0.22, ease: EASE }}
      style={{ zIndex: 10 - index }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      role={toast.tone === "error" ? "alert" : "status"}
      aria-live={toast.tone === "error" ? "assertive" : "polite"}
      className={cn(
        "pointer-events-auto flex w-full items-start gap-3 rounded-lg border border-line bg-surface p-3.5 shadow-pop",
      )}
    >
      <Icon className={cn("mt-0.5 size-4 shrink-0", meta.className)} aria-hidden="true" />

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-[13px] leading-tight font-medium text-ink">{toast.title}</p>
        {toast.description ? (
          <p className="text-[12.5px] leading-relaxed text-ink-2">{toast.description}</p>
        ) : null}

        {toast.action ? (
          <Button
            size="xs"
            variant="secondary"
            className="mt-1 w-fit"
            onClick={() => {
              toast.action?.onClick();
              onDismiss();
            }}
          >
            {toast.action.label}
          </Button>
        ) : null}
      </div>

      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="-mt-0.5 -mr-0.5 rounded-full p-1 text-ink-3 transition-colors duration-150 ease-soft hover:bg-surface-2 hover:text-ink"
      >
        <X className="size-3.5" />
      </button>
    </motion.div>
  );
}
