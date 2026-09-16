import { create } from "zustand";

export type Density = "comfortable" | "compact";

/** Identifiers for the quick-action modals launched from the dashboard. */
export type QuickActionId = "upload" | "invite" | "sync" | null;

interface UIState {
  commandOpen: boolean;
  shortcutsOpen: boolean;
  quickAction: QuickActionId;
  /**
   * The generation dialog is opened from several places (sidebar, dashboard,
   * queue, command palette) so its open state lives here rather than in each
   * caller, and only one instance is ever mounted.
   */
  generateOpen: boolean;
  /** Pre-selects a brand when the dialog is opened from a brand context. */
  generateBrand: string | null;
  density: Density;
  setCommandOpen: (open: boolean) => void;
  toggleCommand: () => void;
  setShortcutsOpen: (open: boolean) => void;
  setQuickAction: (action: QuickActionId) => void;
  setGenerateOpen: (open: boolean, brandId?: string) => void;
  setDensity: (density: Density) => void;
}

export const useUIStore = create<UIState>((set) => ({
  commandOpen: false,
  shortcutsOpen: false,
  quickAction: null,
  generateOpen: false,
  generateBrand: null,
  density: "comfortable",
  setCommandOpen: (open) => set({ commandOpen: open }),
  toggleCommand: () => set((state) => ({ commandOpen: !state.commandOpen })),
  setShortcutsOpen: (open) => set({ shortcutsOpen: open }),
  setQuickAction: (action) => set({ quickAction: action }),
  setGenerateOpen: (open, brandId) =>
    set({ generateOpen: open, generateBrand: brandId ?? null }),
  setDensity: (density) => set({ density }),
}));
