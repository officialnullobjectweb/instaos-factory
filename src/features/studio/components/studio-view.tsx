"use client";

import {
  Camera,
  Check,
  FileDown,
  FolderArchive,
  Grid3X3,
  Image as ImageIcon,
  Move3D,
  Monitor,
  Palette,
  Save,
  Trash2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/input";
import { AlignmentEditor } from "@/features/studio/components/alignment-editor";
import { AssetBrowser } from "@/features/studio/components/asset-browser";
import { DesignInspector } from "@/features/studio/components/design-inspector";
import { QualityPanel } from "@/features/studio/components/quality-panel";
import { SlideCanvas } from "@/features/studio/components/slide-canvas";
import { SlideEditor } from "@/features/studio/components/slide-editor";
import { VariantPanel } from "@/features/studio/components/variant-panel";
import {
  useStudioStore,
  type PreviewMode,
  type StudioTab,
} from "@/features/studio/store/studio-store";
import { evaluateQuick } from "@/features/studio/lib/quality-summary";
import {
  DesignApiError,
  designApi,
  downloadExport,
  type ExportFormat,
} from "@/lib/api/design-client";
import { toast } from "@/lib/toast";
import type { SavedDesignTemplate } from "@/lib/repositories/design-templates-repository";
import { cn } from "@/lib/utils";

const PREVIEW_MODES: Array<{ id: PreviewMode; label: string; icon: typeof Monitor }> = [
  { id: "desktop", label: "Desktop", icon: Monitor },
  { id: "instagram", label: "Instagram", icon: Camera },
  { id: "grid", label: "Grid", icon: Grid3X3 },
];

const TABS: Array<{ id: StudioTab; label: string; icon: LucideIcon }> = [
  { id: "canvas", label: "Copy", icon: FileDown },
  { id: "align", label: "Align", icon: Move3D },
  { id: "style", label: "Style", icon: Palette },
  { id: "assets", label: "Assets", icon: ImageIcon },
  { id: "quality", label: "Quality", icon: Check },
  { id: "templates", label: "Presets", icon: Save },
];

const EXPORTS: Array<{ id: ExportFormat; label: string; icon: typeof ImageIcon }> = [
  { id: "png", label: "PNG", icon: ImageIcon },
  { id: "pdf", label: "PDF", icon: FileDown },
  { id: "zip", label: "ZIP of slides", icon: FolderArchive },
];

export function StudioView() {
  const document_ = useStudioStore((state) => state.document);
  const selected = useStudioStore((state) => state.selected);
  const select = useStudioStore((state) => state.select);
  const previewMode = useStudioStore((state) => state.previewMode);
  const setPreviewMode = useStudioStore((state) => state.setPreviewMode);
  const tab = useStudioStore((state) => state.tab);
  const setTab = useStudioStore((state) => state.setTab);
  const dirty = useStudioStore((state) => state.dirty);
  const load = useStudioStore((state) => state.load);
  const markSaved = useStudioStore((state) => state.markSaved);

  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveNote, setSaveNote] = useState("");
  const [presets, setPresets] = useState<SavedDesignTemplate[]>([]);
  const [currentSlidePng, setCurrentSlidePng] = useState(false);

  useEffect(() => {
    void designApi.templates
      .list()
      .then((result) => setPresets(result.templates))
      .catch(() => undefined);
  }, [dirty]);

  const slide = document_.slides[selected];

  async function runExport(format: ExportFormat, slideIndex?: number) {
    setExporting(format);
    try {
      await downloadExport(
        { templateId: document_.templateId, overrides: document_.overrides, slides: document_.slides },
        format,
        slideIndex,
      );
      toast.success(
        format === "png"
          ? `Slide ${slideIndex ?? 1} exported`
          : format === "pdf"
            ? "PDF exported"
            : "ZIP exported",
        { description: "Rendered server-side at 1080×1350." },
      );
    } catch (error) {
      // A blocked export is a refused export, not a crash: the verbatim gate
      // message names the slide and the reason.
      toast.error(
        error instanceof Error ? error.message : "Export failed",
        {
          description:
            error instanceof DesignApiError && error.detail
              ? error.detail
              : error instanceof Error
                ? error.message
                : "Unknown error",
        },
      );
    } finally {
      setExporting(null);
    }
  }

  async function savePreset() {
    try {
      await designApi.templates.create({
        name: saveName.trim() || "Untitled preset",
        description: saveNote.trim(),
        document: document_,
      });
      setPresets((await designApi.templates.list()).templates);
      setSaveOpen(false);
      setSaveName("");
      setSaveNote("");
      markSaved();
      toast.success("Preset saved", {
        description: "Load it from the Presets tab any time.",
      });
    } catch (error) {
      toast.error("Could not save preset", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return (
    <div className="shell-container flex flex-col gap-5 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <h1 className="text-[22px] font-medium tracking-[-0.02em] text-ink">
            Design Studio
          </h1>
          <p className="text-[13px] text-ink-2">
            1080×1350 carousels rendered in-house — SVG in, PNG/PDF/ZIP out.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {EXPORTS.map((item) => {
            const Icon = item.icon;
            const pngScope = currentSlidePng ? slide?.index : undefined;
            return (
              <Button
                key={item.id}
                size="sm"
                variant={item.id === "png" ? "primary" : "secondary"}
                disabled={exporting !== null}
                onClick={() =>
                  void runExport(item.id, item.id === "png" ? pngScope : undefined)
                }
              >
                <Icon />
                {exporting === item.id
                  ? "Rendering…"
                  : item.id === "png" && currentSlidePng
                    ? `PNG #${slide?.index ?? 1}`
                    : item.label}
              </Button>
            );
          })}
          <Button size="sm" variant="secondary" onClick={() => setSaveOpen(true)}>
            <Save />
            Save preset
          </Button>
        </div>
      </div>

      {/* Preview mode switch + per-slide PNG toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-0.5 rounded-full border border-line bg-surface p-0.5">
          {PREVIEW_MODES.map((mode) => {
            const Icon = mode.icon;
            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => setPreviewMode(mode.id)}
                aria-pressed={previewMode === mode.id}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors duration-150 ease-soft",
                  previewMode === mode.id
                    ? "bg-ink text-canvas"
                    : "text-ink-2 hover:text-ink",
                )}
              >
                <Icon className="size-3.5" />
                {mode.label}
              </button>
            );
          })}
        </div>

        <label className="flex cursor-pointer items-center gap-2.5 text-[12.5px] text-ink-2">
          <Switch
            checked={currentSlidePng}
            onCheckedChange={setCurrentSlidePng}
            aria-label="Export only the selected slide as PNG"
          />
          PNG exports slide {slide?.index ?? 1} only
        </label>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        {/* Left rail: one panel at a time, pinned while the canvas scrolls */}
        <div className="flex flex-col gap-4 xl:sticky xl:top-5 xl:col-span-3 xl:max-h-[calc(100vh-2.5rem)] xl:self-start xl:overflow-y-auto xl:pr-1">
          <div
            role="tablist"
            aria-label="Studio panels"
            className="grid grid-cols-3 gap-1 rounded-lg border border-line bg-surface-2 p-1"
          >
            {TABS.map((entry) => {
              const Icon = entry.icon;
              const active = tab === entry.id;
              return (
                <button
                  key={entry.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(entry.id)}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[11.5px] font-medium transition-colors duration-150 ease-soft",
                    active
                      ? "bg-surface text-ink shadow-card"
                      : "text-ink-2 hover:text-ink",
                  )}
                >
                  <Icon className="size-3.5" />
                  {entry.label}
                </button>
              );
            })}
          </div>

          <Card className="gap-0 p-4">
            {tab === "canvas" ? (
              <SlideEditor />
            ) : tab === "align" ? (
              <AlignmentEditor />
            ) : tab === "style" ? (
              <DesignInspector />
            ) : tab === "assets" ? (
              <AssetBrowser />
            ) : tab === "quality" ? (
              <QualityPanel />
            ) : (
              <PresetList
                presets={presets}
                onLoad={(preset) => load(preset.document, preset.id)}
                onDelete={async (id) => {
                  await designApi.templates.remove(id);
                  setPresets((await designApi.templates.list()).templates);
                  toast.success("Preset deleted");
                }}
              />
            )}
          </Card>
        </div>

        {/* Centre: the canvas itself */}
        <div className="flex flex-col gap-4 xl:col-span-6">
          {previewMode === "grid" ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {document_.slides.map((entry, index) => (
                <button
                  key={entry.index}
                  type="button"
                  onClick={() => select(index)}
                  className={cn(
                    "rounded-lg outline-none transition-shadow duration-200 ease-soft",
                    index === selected ? "ring-2 ring-ink/25" : "hover:shadow-soft",
                  )}
                >
                  <SlideCanvas
                    slide={entry}
                    templateId={document_.templateId}
                    overrides={document_.overrides}
                    static
                  />
                  <span className="mt-1 block text-center font-mono text-[10px] text-ink-3 tnum">
                    {entry.index}
                  </span>
                </button>
              ))}
            </div>
          ) : previewMode === "instagram" ? (
            <InstagramPreview>
              <SlideCanvas
                slide={slide}
                templateId={document_.templateId}
                overrides={document_.overrides}
              />
            </InstagramPreview>
          ) : (
            <SlideCanvas
              slide={slide}
              templateId={document_.templateId}
              overrides={document_.overrides}
              className="mx-auto w-full max-w-[26rem]"
            />
          )}

          {/* Filmstrip */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {document_.slides.map((entry, index) => (
              <button
                key={entry.index}
                type="button"
                onClick={() => select(index)}
                className={cn(
                  "w-20 shrink-0 rounded-lg outline-none transition-shadow duration-200 ease-soft",
                  index === selected ? "ring-2 ring-ink/25" : "opacity-80 hover:opacity-100",
                )}
              >
                <SlideCanvas
                  slide={entry}
                  templateId={document_.templateId}
                  overrides={document_.overrides}
                  static
                />
              </button>
            ))}
          </div>
        </div>

        {/* Right rail: variants + niche context */}
        <div className="flex flex-col gap-4 xl:col-span-3">
          <VariantPanel />

          <Card>
            <CardHeader>
              <CardTitle>Quality, inline</CardTitle>
              <p className="text-[13px] text-ink-2">
                The full report lives in the Quality tab; this is the gate.
              </p>
            </CardHeader>
            <CardContent className="pt-0">
              <QualitySummary />
            </CardContent>
          </Card>
        </div>
      </div>

      <Modal
        open={saveOpen}
        onOpenChange={setSaveOpen}
        size="sm"
        title="Save as preset"
        description="Presets store the template, overrides and all seven slides."
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setSaveOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={() => void savePreset()}>
              <Check />
              Save
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3 pb-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="preset-name">Name</Label>
            <Input
              id="preset-name"
              value={saveName}
              onChange={(event) => setSaveName(event.target.value)}
              placeholder="Atlas — dark cartographic"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="preset-note">Note (optional)</Label>
            <Textarea
              id="preset-note"
              value={saveNote}
              onChange={(event) => setSaveNote(event.target.value)}
              placeholder="When to reach for this preset."
              className="min-h-16"
            />
          </div>
        </div>
      </Modal>

    </div>
  );
}

/* ------------------------------- sub-panels -------------------------------- */

function QualitySummary() {
  const document_ = useStudioStore((state) => state.document);
  const result = evaluateQuick(document_);

  if (result.passed) {
    return (
      <p className="flex items-center gap-2 text-[12.5px] text-ink-2">
        <Check className="size-3.5 text-success" />
        All checks pass — word limits, contrast and fit.
      </p>
    );
  }

  return (
    <p className="text-[12.5px] leading-relaxed text-ink-2">
      <span className="text-danger">{result.errors} blocking</span> and{" "}
      <span className="text-warning">{result.warnings} advisory</span> issues. Open the
      Quality tab for specifics.
    </p>
  );
}

function PresetList({
  presets,
  onLoad,
  onDelete,
}: {
  presets: SavedDesignTemplate[];
  onLoad: (preset: SavedDesignTemplate) => void;
  onDelete: (id: string) => void | Promise<void>;
}) {
  const [confirmId, setConfirmId] = useState<string | null>(null);

  if (presets.length === 0) {
    return (
      <p className="py-6 text-center text-[12.5px] text-ink-2">
        No presets yet. Configure the design, then “Save preset”.
      </p>
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-line">
      {presets.map((preset) => (
        <li key={preset.id} className="flex items-center gap-2 py-2.5">
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[12.5px] font-medium text-ink">
              {preset.name}
            </span>
            {preset.description ? (
              <span className="truncate text-[11px] text-ink-3">{preset.description}</span>
            ) : null}
          </span>
          <Button size="xs" variant="secondary" onClick={() => onLoad(preset)}>
            Load
          </Button>
          {confirmId === preset.id ? (
            <Button
              size="xs"
              variant="danger"
              onClick={() => {
                setConfirmId(null);
                void onDelete(preset.id);
              }}
            >
              Sure?
            </Button>
          ) : (
            <Button
              size="xs"
              variant="ghost"
              aria-label={`Delete ${preset.name}`}
              onClick={() => setConfirmId(preset.id)}
            >
              <Trash2 />
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}

function InstagramPreview({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[24rem]">
      {/* Phone-chrome framing: the post card as the feed shows it. */}
      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        <div className="flex items-center gap-2 px-3 py-2.5">
          <span className="size-7 rounded-full bg-surface-3" aria-hidden="true" />
          <span className="flex flex-col leading-none">
            <span className="text-[12px] font-medium text-ink">midnightritual</span>
            <span className="mt-0.5 text-[10px] text-ink-3">Sponsored</span>
          </span>
          <span className="ml-auto text-[16px] text-ink-3" aria-hidden="true">
            ···
          </span>
        </div>
        {children}
        <div className="flex items-center gap-3 px-3 py-2.5 text-[16px] text-ink-3" aria-hidden="true">
          <span>♡</span>
          <span>◌</span>
          <span>➢</span>
          <span className="ml-auto">🖼</span>
        </div>
        <div className="px-3 pb-3">
          <span className="block text-[12px] text-ink">
            <span className="font-medium">midnightritual</span> Slide 1 of 7 · swipe
          </span>
        </div>
      </div>
    </div>
  );
}
