import { create } from "zustand";

/**
 * Toasts, in-house.
 *
 * The app ships its own stack rather than a third-party host so the visuals come
 * from the same tokens as everything else and there is no second design language
 * hiding in a dependency. `lib/toast.ts` keeps the call shape the rest of the app
 * already uses (`toast.success(title, { description, action })`).
 */

export type ToastTone = "success" | "error" | "warning" | "info";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastRecord {
  id: string;
  tone: ToastTone;
  title: string;
  description?: string;
  action?: ToastAction;
  /** Milliseconds before auto-dismiss; 0 keeps it until dismissed. */
  duration: number;
  createdAt: number;
}

export interface ToastOptions {
  description?: string;
  action?: ToastAction;
  duration?: number;
}

interface ToastState {
  toasts: ToastRecord[];
  push: (toast: Omit<ToastRecord, "id" | "createdAt">) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

/** Only a few are ever visible; the stack collapses the rest behind a counter. */
export const MAX_VISIBLE_TOASTS = 3;
export const DEFAULT_TOAST_DURATION = 5200;

let counter = 0;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  push: (toast) => {
    counter += 1;
    const id = `toast-${counter}`;
    set((state) => ({
      // Newest first: the stack grows downward from the latest event.
      toasts: [{ ...toast, id, createdAt: Date.now() }, ...state.toasts].slice(0, 6),
    }));
    return id;
  },

  dismiss: (id) =>
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),

  clear: () => set({ toasts: [] }),
}));
