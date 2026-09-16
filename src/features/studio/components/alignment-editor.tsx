"use client";

import {
  AlignCenterVertical,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  CircleCheck,
  RotateCcw,
  TriangleAlert,
  Copy,
} from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { composeSlide, hasMotif, resolveAdjustments } from "@/design/compose";
import { fitSlide } from "@/design/fit";
import { resolveTemplate } from "@/design/templates";
import {
  ADJUSTMENT_LIMITS,
  DEFAULT_ADJUSTMENTS,
  type SlideAdjustments,
  type TextAlign,
  type VerticalAnchor,
} from "@/design/types";
import { useStudioStore } from "@/features/studio/store/studio-store";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

/**
 * Alignment and positioning for one slide.
 *
 * The anchor grid, the nudge pad and the scales all write `slide.adjust`, which
 * the shared composer reads — so the preview, the export and the quality report
 * move together. A live readout underneath reports the composed block's height
 * against the space it actually has, which turns "does this look right?" into a
 * number.
 */

const NUDGE = 8;

const COLUMNS: Array<{ value: TextAlign; label: string }> = [
  { value: "left", label: "Left" },
  { value: "center", label: "Centre" },
  { value: "right", label: "Right" },
];

const ROWS: Array<{ value: VerticalAnchor; label: string }> = [
  { value: "top", label: "Top" },
  { value: "middle", label: "Middle" },
  { value: "bottom", label: "Bottom" },
];

export function AlignmentEditor() {
  const document_ = useStudioStore((state) => state.document);
  const selected = useStudioStore((state) => state.selected);
  const patchSlide = useStudioStore((state) => state.patchSlide);

  const slide = document_.slides[selected];
  const template = resolveTemplate(document_.templateId, document_.overrides);

  const adjust = resolveAdjustments(slide?.adjust);
  const fit = slide ? fitSlide(slide, template) : null;
  const composed = slide ? composeSlide(slide, template, fit!.displaySize) : null;

  /* ------------------------------ keyboard nudge ---------------------------- */

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const target = event.target as HTMLElement | null;
      // Never steal keys from a field the user is typing in.
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      const step = event.shiftKey ? NUDGE * 5 : NUDGE;
      const current = resolveAdjustments(slide?.adjust);

      const move: Record<string, SlideAdjustments> = {
        ArrowLeft: { offsetX: current.offsetX - step },
        ArrowRight: { offsetX: current.offsetX + step },
        ArrowUp: { offsetY: current.offsetY - step },
        ArrowDown: { offsetY: current.offsetY + step },
      };

      const patch = move[event.key];
      if (!patch || !slide) return;

      event.preventDefault();
      patchSlide(selected, { adjust: { ...slide.adjust, ...patch } });
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [patchSlide, selected, slide]);

  if (!slide || !composed || !fit) return null;

  function patch(next: SlideAdjustments) {
    patchSlide(selected, { adjust: { ...slide?.adjust, ...next } });
  }

  function reset() {
    patchSlide(selected, { adjust: undefined });
  }

  function applyToAll() {
    document_.slides.forEach((entry, index) => {
      patchSlide(index, { adjust: { ...entry.adjust, ...slide?.adjust } });
    });
    toast.success("Alignment applied to all 7 slides", {
      description: "Copy stays as it is — only the block placement changed.",
    });
  }

  const headroom = composed.contentBottom - composed.blockBottom;
  const fits = !composed.overflow;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <span className="text-[11px] font-medium tracking-[0.08em] text-ink-3 uppercase">
          Slide {slide.index} placement
        </span>
        <p className="text-[12px] leading-relaxed text-ink-2">
          Move the whole text block. Copy, type scale and the motif band are
          recomposed together, so nothing can overlap.
        </p>
      </div>

      {/* Anchor grid */}
      <section className="flex flex-col gap-2.5">
        <Label>Anchor</Label>
        <div
          role="radiogroup"
          aria-label="Text block anchor"
          className="grid grid-cols-3 gap-1 rounded-lg border border-line bg-surface-2 p-1.5"
        >
          {ROWS.map((row) =>
            COLUMNS.map((column) => {
              const active =
                adjust.align === column.value && adjust.vertical === row.value;
              return (
                <button
                  key={`${row.value}-${column.value}`}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  aria-label={`${row.label} ${column.label}`}
                  onClick={() =>
                    patch({ align: column.value, vertical: row.value })
                  }
                  className={cn(
                    "flex h-9 items-center justify-center rounded-md border transition-colors duration-150 ease-soft",
                    active
                      ? "border-ink/25 bg-surface text-ink"
                      : "border-transparent text-ink-3 hover:bg-surface hover:text-ink-2",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "size-1.5 rounded-full",
                      active ? "bg-ink" : "bg-ink-3/50",
                      column.value === "left" && "mr-2.5",
                      column.value === "right" && "ml-2.5",
                    )}
                  />
                </button>
              );
            }),
          )}
        </div>
        <span className="text-[11px] text-ink-3">
          {ROWS.find((row) => row.value === adjust.vertical)?.label} ·{" "}
          {COLUMNS.find((column) => column.value === adjust.align)?.label}
        </span>
      </section>

      {/* Nudge pad */}
      <section className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-2">
          <Label>Nudge</Label>
          <span className="font-mono text-[11px] text-ink-3 tnum">
            x {adjust.offsetX > 0 ? "+" : ""}
            {adjust.offsetX} · y {adjust.offsetY > 0 ? "+" : ""}
            {adjust.offsetY}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="grid grid-cols-3 grid-rows-3 gap-1">
            <span />
            <NudgeButton
              label="Nudge up"
              onClick={() => patch({ offsetY: adjust.offsetY - NUDGE })}
            >
              <ArrowUp />
            </NudgeButton>
            <span />
            <NudgeButton
              label="Nudge left"
              onClick={() => patch({ offsetX: adjust.offsetX - NUDGE })}
            >
              <ArrowLeft />
            </NudgeButton>
            <NudgeButton
              label="Reset nudges"
              onClick={() => patch({ offsetX: 0, offsetY: 0 })}
            >
              <AlignCenterVertical />
            </NudgeButton>
            <NudgeButton
              label="Nudge right"
              onClick={() => patch({ offsetX: adjust.offsetX + NUDGE })}
            >
              <ArrowRight />
            </NudgeButton>
            <span />
            <NudgeButton
              label="Nudge down"
              onClick={() => patch({ offsetY: adjust.offsetY + NUDGE })}
            >
              <ArrowDown />
            </NudgeButton>
            <span />
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="text-[11.5px] text-ink-2">
              Arrow keys nudge by {NUDGE}px, Shift + arrow by {NUDGE * 5}px.
            </span>
            <span className="text-[11px] leading-relaxed text-ink-3">
              Offsets stay inside ±{ADJUSTMENT_LIMITS.offsetX}px horizontally and
              ±{ADJUSTMENT_LIMITS.offsetY}px vertically, so a slide cannot be
              pushed off the canvas.
            </span>
          </div>
        </div>
      </section>

      {/* Scales */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="slide-type-scale">Type scale</Label>
            <span className="font-mono text-[11px] text-ink-2 tnum">
              {Math.round(adjust.scale * 100)}%
            </span>
          </div>
          <input
            id="slide-type-scale"
            type="range"
            min={ADJUSTMENT_LIMITS.scale.min}
            max={ADJUSTMENT_LIMITS.scale.max}
            step={ADJUSTMENT_LIMITS.scale.step}
            value={adjust.scale}
            onChange={(event) => patch({ scale: Number(event.target.value) })}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-surface-3 accent-ink"
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="slide-motif-scale">Motif size</Label>
            <span className="font-mono text-[11px] text-ink-2 tnum">
              {Math.round(adjust.motifScale * 100)}%
            </span>
          </div>
          <input
            id="slide-motif-scale"
            type="range"
            min={ADJUSTMENT_LIMITS.motifScale.min}
            max={ADJUSTMENT_LIMITS.motifScale.max}
            step={ADJUSTMENT_LIMITS.motifScale.step}
            value={adjust.motifScale}
            disabled={!hasMotif(slide)}
            onChange={(event) => patch({ motifScale: Number(event.target.value) })}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-surface-3 accent-ink disabled:cursor-not-allowed disabled:opacity-40"
          />
          <span className="text-[11px] text-ink-3">
            {hasMotif(slide)
              ? `Reserves ${Math.round(composed.motifHeight)}px at the top of the slide.`
              : "This slide has no motif — pick one in the Slide tab."}
          </span>
        </div>
      </section>

      {/* Live fit readout */}
      <section
        className={cn(
          "flex flex-col gap-2 rounded-lg border px-3.5 py-3",
          fits ? "border-line bg-surface-2" : "border-danger/30 bg-danger-soft",
        )}
      >
        <span className="flex items-center gap-2 text-[12.5px] font-medium">
          {fits ? (
            <>
              <CircleCheck className="size-3.5 text-success" />
              <span className="text-ink">Fits the safe area</span>
            </>
          ) : (
            <>
              <TriangleAlert className="size-3.5 text-danger" />
              <span className="text-danger">Block overflows the safe area</span>
            </>
          )}
        </span>
        <dl className="grid grid-cols-3 gap-2">
          <Readout label="Block" value={`${Math.round(composed.blockHeight)}px`} />
          <Readout label="Space" value={`${Math.round(composed.contentBottom - composed.contentTop)}px`} />
          <Readout
            label={headroom >= 0 ? "Spare" : "Over by"}
            value={`${Math.abs(Math.round(headroom))}px`}
          />
        </dl>
        {!fits ? (
          <span className="text-[11.5px] leading-relaxed text-ink-2">
            Lower the type scale or trim the body — the export is blocked until
            this passes.
          </span>
        ) : null}
      </section>

      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
        <Button size="xs" variant="secondary" onClick={applyToAll}>
          <Copy />
          Apply to all slides
        </Button>
        <Button
          size="xs"
          variant="ghost"
          onClick={reset}
          disabled={
            JSON.stringify(adjust) === JSON.stringify(DEFAULT_ADJUSTMENTS)
          }
        >
          <RotateCcw />
          Reset slide
        </Button>
      </div>
    </div>
  );
}

function NudgeButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex size-8 items-center justify-center rounded-md border border-line bg-surface text-ink-2 transition-colors duration-150 ease-soft hover:border-line-strong hover:text-ink [&_svg]:size-3.5"
    >
      {children}
    </button>
  );
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[10.5px] tracking-[0.06em] text-ink-3 uppercase">
        {label}
      </dt>
      <dd className="font-mono text-[12.5px] text-ink tnum">{value}</dd>
    </div>
  );
}
