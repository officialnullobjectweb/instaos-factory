"use client";

import { Plus, Trash2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/input";
import { assetLibrary } from "@/design/data/assets";
import { wordsPerSlide, MAX_WORDS_PER_SLIDE } from "@/design/quality";
import type { SlideLayout, SlideMotif, SlideSpec } from "@/design/types";
import { LAYOUT_LABELS, MOTIF_LABELS, useStudioStore } from "@/features/studio/store/studio-store";
import { cn } from "@/lib/utils";

/**
 * The inspector: every editable field of the selected slide.
 *
 * Word count lives next to the body field because the 45-word rule is the one
 * quality gate people actually hit — showing it at the point of typing beats
 * making the reviewer discover it in a separate report.
 */

const MOTIF_OPTIONS: SlideMotif[] = [
  "none",
  "map",
  "icon",
  "pattern",
  "illustration",
  "flag",
];

const LAYOUT_OPTIONS: SlideLayout[] = ["cover", "statement", "data", "closing"];

export function SlideEditor() {
  const document_ = useStudioStore((state) => state.document);
  const selected = useStudioStore((state) => state.selected);
  const patchSlide = useStudioStore((state) => state.patchSlide);

  const slide = document_.slides[selected];
  if (!slide) return null;

  const words = wordsPerSlide(slide);
  const wordsOver = words > MAX_WORDS_PER_SLIDE;

  const availableAssets =
    slide.motif === "icon"
      ? assetLibrary.icons
      : slide.motif === "pattern"
        ? assetLibrary.patterns
        : slide.motif === "illustration"
          ? assetLibrary.illustrations
          : slide.motif === "flag"
            ? assetLibrary.flags
            : [];

  function update(patch: Partial<SlideSpec>) {
    patchSlide(selected, patch);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-medium tracking-[0.08em] text-ink-3 uppercase">
          Slide {slide.index} of {document_.slides.length}
        </span>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[11px] tnum",
            wordsOver ? "bg-danger-soft text-danger" : "bg-surface-2 text-ink-2",
          )}
        >
          {words}/{MAX_WORDS_PER_SLIDE} words
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="slide-layout">Layout</Label>
          <Select
            value={slide.layout}
            onValueChange={(value) => update({ layout: value as SlideLayout })}
          >
            <SelectTrigger id="slide-layout" className="w-full">
              <SelectValue>{LAYOUT_LABELS[slide.layout]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {LAYOUT_OPTIONS.map((layout) => (
                <SelectItem key={layout} value={layout}>
                  {LAYOUT_LABELS[layout]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="slide-motif">Motif</Label>
          <Select
            value={slide.motif ?? "none"}
            onValueChange={(value) => update({ motif: value as SlideMotif })}
          >
            <SelectTrigger id="slide-motif" className="w-full">
              <SelectValue>{MOTIF_LABELS[slide.motif ?? "none"]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {MOTIF_OPTIONS.map((motif) => (
                <SelectItem key={motif} value={motif}>
                  {MOTIF_LABELS[motif]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="slide-kicker">Kicker</Label>
        <Input
          id="slide-kicker"
          value={slide.kicker}
          onChange={(event) => update({ kicker: event.target.value })}
          placeholder="Field note 014"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="slide-headline">Headline</Label>
        <Textarea
          id="slide-headline"
          value={slide.headline}
          onChange={(event) => update({ headline: event.target.value })}
          className="min-h-16"
          placeholder="The one line the slide is about"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="slide-body">Body</Label>
        <Textarea
          id="slide-body"
          value={slide.body}
          onChange={(event) => update({ body: event.target.value })}
          placeholder="Two or three sentences of support."
        />
      </div>

      {slide.layout === "data" ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="slide-stat-value">Stat value</Label>
            <Input
              id="slide-stat-value"
              value={slide.stat?.value ?? ""}
              onChange={(event) =>
                update({
                  stat: { value: event.target.value, label: slide.stat?.label ?? "" },
                })
              }
              placeholder="94k"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="slide-stat-label">Stat label</Label>
            <Input
              id="slide-stat-label"
              value={slide.stat?.label ?? ""}
              onChange={(event) =>
                update({
                  stat: { value: slide.stat?.value ?? "", label: event.target.value },
                })
              }
              placeholder="transits annually"
            />
          </div>
        </div>
      ) : null}

      {slide.motif === "map" ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="slide-countries">Highlight countries</Label>
          <Input
            id="slide-countries"
            value={(slide.highlightCountries ?? []).join(", ")}
            onChange={(event) =>
              update({
                highlightCountries: event.target.value
                  .split(",")
                  .map((entry) => entry.trim())
                  .filter(Boolean),
              })
            }
            placeholder="Malaysia, Indonesia, Singapore"
          />
          <span className="text-[11px] text-ink-3">
            Comma-separated, matched against the world map.
          </span>
        </div>
      ) : null}

      {availableAssets.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <Label>Asset</Label>
          <div className="flex flex-wrap gap-1.5">
            {availableAssets.map((asset) => (
              <button
                key={asset.id}
                type="button"
                onClick={() => update({ assetRef: `${slide.motif === "flag" ? "flag" : slide.motif === "icon" ? "icon" : slide.motif === "pattern" ? "pat" : "ill"}:${asset.id}` })}
                aria-pressed={slide.assetRef?.endsWith(asset.id)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[11.5px] transition-colors duration-150 ease-soft",
                  slide.assetRef?.endsWith(asset.id)
                    ? "border-ink/25 bg-surface-2 text-ink"
                    : "border-line text-ink-2 hover:bg-surface-2",
                )}
              >
                {asset.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex items-center gap-2 border-t border-line pt-3">
        <button
          type="button"
          onClick={() => update({ footnote: undefined })}
          className="flex items-center gap-1.5 rounded-full px-2 py-1 text-[11.5px] text-ink-3 transition-colors duration-150 ease-soft hover:bg-surface-2 hover:text-ink"
        >
          <Trash2 className="size-3" />
          Clear footnote
        </button>
        <span className="ml-auto flex items-center gap-1 text-[11px] text-ink-3">
          <Plus className="size-3" />
          {document_.slides.length} slides (fixed at 7)
        </span>
      </div>
    </div>
  );
}
