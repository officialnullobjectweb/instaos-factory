import { create } from "zustand";

import { defaultDeck } from "@/design/templates";
import type {
  DesignDocument,
  DesignOverrides,
  SlideSpec,
  SlideMotif,
  SlideLayout,
  TemplateId,
} from "@/design/types";

/**
 * The studio's document state.
 *
 * Kept in a store rather than component state because the editor panels (canvas,
 * slide list, asset library, inspector, quality panel) all mutate the same
 * document, and every preview must reflect the change in the same tick.
 */

export type PreviewMode = "desktop" | "instagram" | "grid";
export type PreviewTheme = "system" | "light" | "dark";

export type StudioTab =
  | "canvas"
  | "align"
  | "style"
  | "assets"
  | "quality"
  | "templates";

interface StudioState {
  document: DesignDocument;
  /** Index of the slide being edited (0-based). */
  selected: number;
  previewMode: PreviewMode;
  previewTheme: PreviewTheme;
  tab: StudioTab;
  dirty: boolean;
  /** Saved-template id this document came from, if any. */
  sourceId: string | null;

  setTemplate: (templateId: TemplateId) => void;
  setOverrides: (overrides: DesignOverrides) => void;
  patchSlide: (index: number, patch: Partial<SlideSpec>) => void;
  select: (index: number) => void;
  setPreviewMode: (mode: PreviewMode) => void;
  setPreviewTheme: (theme: PreviewTheme) => void;
  setTab: (tab: StudioTab) => void;
  /** Replace the whole document (template load, variant apply, reset). */
  load: (document_: DesignDocument, sourceId?: string | null) => void;
  markSaved: () => void;
}

export const useStudioStore = create<StudioState>((set) => ({
  document: {
    templateId: "geography",
    overrides: {},
    slides: defaultDeck("geography"),
  },
  selected: 0,
  previewMode: "desktop",
  previewTheme: "system",
  tab: "canvas",
  dirty: false,
  sourceId: null,

  setTemplate: (templateId) =>
    set((state) => {
      // Switching template keeps the copy but resets overrides — palettes are
      // template-owned and mixing them produces the worst of both.
      return {
        document: { ...state.document, templateId, overrides: {} },
        dirty: true,
        sourceId: null,
      };
    }),

  setOverrides: (overrides) =>
    set((state) => ({
      document: { ...state.document, overrides },
      dirty: true,
      sourceId: null,
    })),

  patchSlide: (index, patch) =>
    set((state) => ({
      document: {
        ...state.document,
        slides: state.document.slides.map((slide, i) =>
          i === index ? { ...slide, ...patch } : slide,
        ),
      },
      dirty: true,
    })),

  select: (index) => set({ selected: index }),
  setPreviewMode: (previewMode) => set({ previewMode }),
  setPreviewTheme: (previewTheme) => set({ previewTheme }),
  setTab: (tab) => set({ tab }),

  load: (document_, sourceId = null) =>
    set({ document: document_, selected: 0, dirty: false, sourceId }),

  markSaved: () => set({ dirty: false }),
}));

/* ------------------------------ field helpers ----------------------------- */

export function slidePatchForMotif(motif: SlideMotif): Partial<SlideSpec> {
  return { motif, assetRef: motif === "map" ? undefined : undefined };
}

export const LAYOUT_LABELS: Record<SlideLayout, string> = {
  cover: "Cover",
  statement: "Statement",
  data: "Data",
  closing: "Closing",
};

export const MOTIF_LABELS: Record<SlideMotif, string> = {
  none: "None",
  map: "World map",
  icon: "Icon",
  pattern: "Pattern",
  illustration: "Illustration",
  flag: "Flag",
};
