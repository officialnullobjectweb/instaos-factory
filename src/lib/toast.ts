import { DEFAULT_TOAST_DURATION, useToastStore } from "@/store/toast-store";
import type { ToastOptions, ToastTone } from "@/store/toast-store";

export type { ToastOptions };

/**
 * The single entry point for app toasts.
 *
 * This is a thin façade over the toast store so call sites stay declarative —
 * `toast.success("Approved", { description, action })` — while the rendering
 * lives in `components/ui/toast.tsx`. Nothing here needs a React tree, so it is
 * safe to call from event handlers, stores and effects alike.
 */

function emit(tone: ToastTone, title: string, options?: ToastOptions) {
  return useToastStore.getState().push({
    tone,
    title,
    description: options?.description,
    action: options?.action,
    duration: options?.duration ?? DEFAULT_TOAST_DURATION,
  });
}

export const toast = {
  success: (title: string, options?: ToastOptions) => emit("success", title, options),
  error: (title: string, options?: ToastOptions) => emit("error", title, options),
  warning: (title: string, options?: ToastOptions) => emit("warning", title, options),
  info: (title: string, options?: ToastOptions) => emit("info", title, options),
  dismiss: (id: string) => useToastStore.getState().dismiss(id),
  clear: () => useToastStore.getState().clear(),
};

export type Toast = typeof toast;
