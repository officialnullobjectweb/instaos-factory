"use client";

import { ChevronLeft, ChevronRight, Eye, Pencil } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { InlineField } from "@/features/queue/components/inline-field";
import { cn } from "@/lib/utils";
import type { Slide } from "@/types";

interface CarouselPreviewProps {
  slides: Slide[];
  /** Called with the merged slide stack; the caller persists it. */
  onSaveSlide?: (slides: Slide[]) => Promise<unknown>;
  /** Called once an edit settles, so a version can be recorded. */
  onCommitSlide?: (slides: Slide[]) => void;
  className?: string;
}

const KIND_LABELS: Record<Slide["kind"], string> = {
  cover: "Cover",
  statement: "Statement",
  list: "Rule",
  statistic: "Statistic",
  quote: "Quote",
  cta: "Call to action",
};

export function CarouselPreview({
  slides,
  onSaveSlide,
  onCommitSlide,
  className,
}: CarouselPreviewProps) {
  const [index, setIndex] = useState(0);
  const [editing, setEditing] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);

  // Editing is never more than a click away, so keep it to a short-lived mode.
  const safeIndex = Math.min(index, slides.length - 1);
  const slide = slides[safeIndex];
  const editable = Boolean(onSaveSlide);

  useEffect(() => {
    if (!editing) return;
    frameRef.current?.focus();
  }, [editing]);

  function merged(patch: Partial<Slide>) {
    return slides.map((candidate, position) =>
      position === safeIndex ? { ...candidate, ...patch } : candidate,
    );
  }

  /** Debounced draft write — no version is cut while someone is still typing. */
  function save(patch: Partial<Slide>) {
    if (!onSaveSlide) return;
    void onSaveSlide(merged(patch));
  }

  /** Fired once an edit settles: one write that also records the new version. */
  function commit(patch: Partial<Slide>) {
    onCommitSlide?.(merged(patch));
  }

  function step(direction: -1 | 1) {
    setIndex((current) => {
      const next = current + direction;
      if (next < 0) return slides.length - 1;
      if (next > slides.length - 1) return 0;
      return next;
    });
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div
        ref={frameRef}
        tabIndex={0}
        role="group"
        aria-label={`Carousel preview, slide ${safeIndex + 1} of ${slides.length}`}
        onKeyDown={(event) => {
          if (editing) return;
          if (event.key === "ArrowRight") {
            event.preventDefault();
            step(1);
          }
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            step(-1);
          }
        }}
        className="relative overflow-hidden rounded-xl border border-line bg-surface-2 outline-none focus-visible:ring-2 focus-visible:ring-ink/15"
      >
        <div className="flex aspect-[4/5] flex-col justify-between p-6">
          <div className="flex items-start justify-between gap-3">
            {editing ? (
              <InlineField
                value={slide.kicker}
                label="Slide kicker"
                placeholder="Kicker"
                onSave={(value) => save({ kicker: value })}
                onCommit={(value) => commit({ kicker: value })}
                commitSummary="Edited a slide kicker"
                textClassName="font-mono text-[11px] tracking-[0.08em] text-ink-3 uppercase"
              />
            ) : (
              <span className="font-mono text-[11px] tracking-[0.08em] text-ink-3 uppercase">
                {slide.kicker || KIND_LABELS[slide.kind]}
              </span>
            )}

            <span className="shrink-0 font-mono text-[11px] text-ink-3 tnum">
              {String(safeIndex + 1).padStart(2, "0")} /{" "}
              {String(slides.length).padStart(2, "0")}
            </span>
          </div>

          <div className="flex flex-col gap-3">
            <span className="h-px w-12 bg-line-strong" aria-hidden="true" />

            {editing ? (
              <div className="flex flex-col gap-2">
                <InlineField
                  value={slide.headline}
                  label="Slide headline"
                  placeholder="Headline"
                  onSave={(value) => save({ headline: value })}
                  onCommit={(value) => commit({ headline: value })}
                  commitSummary="Edited a slide headline"
                  textClassName="text-[26px] leading-tight font-medium tracking-[-0.03em]"
                />
                <InlineField
                  value={slide.body}
                  label="Slide body"
                  placeholder="Supporting line"
                  multiline
                  onSave={(value) => save({ body: value })}
                  onCommit={(value) => commit({ body: value })}
                  commitSummary="Edited a slide body"
                  textClassName="text-[14px] leading-relaxed text-ink-2"
                />
              </div>
            ) : (
              <>
                <p
                  className={cn(
                    "font-medium tracking-[-0.03em] text-ink",
                    slide.kind === "statistic"
                      ? "text-[42px] leading-[1.05] tnum"
                      : slide.kind === "cover"
                        ? "text-[30px] leading-tight"
                        : "text-[26px] leading-tight",
                    slide.kind === "quote" && "italic",
                  )}
                >
                  {slide.headline}
                </p>
                <p className="text-[14px] leading-relaxed text-ink-2">{slide.body}</p>
              </>
            )}
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="font-mono text-[10px] tracking-[0.08em] text-ink-3 uppercase">
              {KIND_LABELS[slide.kind]}
            </span>
            {slide.footnote ? (
              <span className="text-[12px] text-ink-3">{slide.footnote}</span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <Button
            size="icon-sm"
            variant="secondary"
            onClick={() => step(-1)}
            aria-label="Previous slide"
          >
            <ChevronLeft />
          </Button>
          <Button
            size="icon-sm"
            variant="secondary"
            onClick={() => step(1)}
            aria-label="Next slide"
          >
            <ChevronRight />
          </Button>
        </div>

        {editable ? (
          <Button
            size="sm"
            variant={editing ? "primary" : "secondary"}
            aria-pressed={editing}
            onClick={() => setEditing((current) => !current)}
          >
            {editing ? <Eye /> : <Pencil />}
            {editing ? "Preview slide" : "Edit slide"}
          </Button>
        ) : null}
      </div>

      <ul className="flex flex-wrap items-stretch gap-2" aria-label="Slide thumbnails">
        {slides.map((candidate, position) => (
          <li key={candidate.id}>
            <button
              type="button"
              onClick={() => setIndex(position)}
              aria-label={`Go to slide ${position + 1}: ${candidate.headline}`}
              aria-current={position === safeIndex}
              className={cn(
                "flex h-20 w-16 flex-col justify-between rounded-md border p-2 text-left outline-none transition-colors duration-150 ease-soft",
                position === safeIndex
                  ? "border-ink/30 bg-surface-2"
                  : "border-line bg-surface hover:bg-surface-2",
              )}
            >
              <span className="font-mono text-[10px] text-ink-3 tnum">
                {String(position + 1).padStart(2, "0")}
              </span>
              <span className="line-clamp-3 text-[10.5px] leading-tight text-ink-2">
                {candidate.headline}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
